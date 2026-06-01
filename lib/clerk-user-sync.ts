import { getSupabaseAdmin } from '@/lib/supabase'
import { parseStorageObjectRefFromPublicUrl, removeStorageObject } from '@/lib/storage/ops'

type StorageRef = {
  bucket: string
  path: string
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

function collectStorageRefsFromJson(value: JsonValue, refs: Map<string, StorageRef>) {
  if (typeof value === 'string') {
    const ref = parseStorageObjectRefFromPublicUrl(value)
    if (ref) {
      refs.set(`${ref.bucket}:${ref.path}`, ref)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStorageRefsFromJson(item, refs)
    }
    return
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectStorageRefsFromJson(nested, refs)
    }
  }
}

function addStorageRef(
  refs: Map<string, StorageRef>,
  options: { bucket?: string | null; path?: string | null; publicUrl?: string | null }
) {
  if (options.bucket && options.path) {
    refs.set(`${options.bucket}:${options.path}`, {
      bucket: options.bucket,
      path: options.path,
    })
    return
  }

  const ref = parseStorageObjectRefFromPublicUrl(options.publicUrl)
  if (ref) {
    refs.set(`${ref.bucket}:${ref.path}`, ref)
  }
}

async function fetchIdsByUserId(table: string, userId: string, column = 'id') {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to fetch ${table}.${column}: ${error.message}`)
  }

  return (data ?? [])
    .map((row) => row[column as keyof typeof row])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

async function deleteByUserId(table: string, userId: string) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from(table).delete().eq('user_id', userId)
  if (error) {
    throw new Error(`Failed to delete ${table} rows for ${userId}: ${error.message}`)
  }
}

async function deleteByIds(table: string, column: string, ids: string[]) {
  if (ids.length === 0) {
    return
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from(table).delete().in(column, ids)
  if (error) {
    throw new Error(`Failed to delete ${table} by ${column}: ${error.message}`)
  }
}

export async function ensureClerkUserWelcomeState(userId: string) {
  const supabase = getSupabaseAdmin()

  // Schema verified via Supabase MCP (2026-06-01):
  // public.user_credits includes user_id, credits_remaining.
  const { data: existingCredits, error: fetchCreditsError } = await supabase
    .from('user_credits')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchCreditsError) {
    throw new Error(`Failed to fetch user_credits for ${userId}: ${fetchCreditsError.message}`)
  }

  let insertedCredits = false

  if (!existingCredits) {
    const { error: insertCreditsError } = await supabase
      .from('user_credits')
      .insert({
        user_id: userId,
        credits_remaining: 0,
      })

    if (insertCreditsError) {
      throw new Error(`Failed to insert user_credits for ${userId}: ${insertCreditsError.message}`)
    }

    insertedCredits = true
  }

  return {
    insertedCredits,
    insertedWelcomeTransaction: false,
  }
}

export async function purgeClerkUserData(userId: string) {
  const supabase = getSupabaseAdmin()
  const avatarProjectIds = await fetchIdsByUserId('avatar_ads_projects', userId)
  const videoCloneProjectIds = await fetchIdsByUserId('video_clone_projects', userId)
  const productIds = await fetchIdsByUserId('user_products', userId)
  const creatorSourceIds = await fetchIdsByUserId('creator_sources', userId)

  const storageRefs = new Map<string, StorageRef>()

  const { data: avatars, error: avatarError } = await supabase
    .from('user_avatars')
    .select('id, storage_bucket, storage_path, photo_url, photo_set_json')
    .eq('user_id', userId)

  if (avatarError) {
    throw new Error(`Failed to load user_avatars for ${userId}: ${avatarError.message}`)
  }

  for (const avatar of avatars ?? []) {
    addStorageRef(storageRefs, {
      bucket: avatar.storage_bucket,
      path: avatar.storage_path,
      publicUrl: avatar.photo_url,
    })

    if (avatar.photo_set_json) {
      collectStorageRefsFromJson(avatar.photo_set_json as JsonValue, storageRefs)
    }
  }

  const { data: productPhotos, error: photoError } = await supabase
    .from('user_product_photos')
    .select('id, storage_bucket, storage_path, photo_url, original_photo_url')
    .eq('user_id', userId)

  if (photoError) {
    throw new Error(`Failed to load user_product_photos for ${userId}: ${photoError.message}`)
  }

  for (const photo of productPhotos ?? []) {
    addStorageRef(storageRefs, {
      bucket: photo.storage_bucket,
      path: photo.storage_path,
      publicUrl: photo.photo_url,
    })
    addStorageRef(storageRefs, {
      publicUrl: photo.original_photo_url,
    })
  }

  const { data: creatorVideos, error: creatorVideoError } = await supabase
    .from('creator_source_videos')
    .select('id, storage_bucket, storage_path, video_url, video_cdn_url, cover_storage_bucket, cover_storage_path, cover_url')
    .eq('user_id', userId)

  if (creatorVideoError) {
    throw new Error(`Failed to load creator_source_videos for ${userId}: ${creatorVideoError.message}`)
  }

  for (const video of creatorVideos ?? []) {
    addStorageRef(storageRefs, {
      bucket: video.storage_bucket,
      path: video.storage_path,
      publicUrl: video.video_cdn_url || video.video_url,
    })
    addStorageRef(storageRefs, {
      bucket: video.cover_storage_bucket,
      path: video.cover_storage_path,
      publicUrl: video.cover_url,
    })
  }

  const { data: referenceVideos, error: referenceVideosError } = await supabase
    .from('reference_videos')
    .select('id, source_storage_bucket, source_storage_path')
    .eq('user_id', userId)

  if (referenceVideosError) {
    throw new Error(`Failed to load reference_videos for ${userId}: ${referenceVideosError.message}`)
  }

  for (const ad of referenceVideos ?? []) {
    addStorageRef(storageRefs, {
      bucket: ad.source_storage_bucket,
      path: ad.source_storage_path,
    })
  }

  for (const ref of storageRefs.values()) {
    await removeStorageObject(supabase, ref.bucket, ref.path)
  }

  await deleteByIds('avatar_ads_scenes', 'project_id', avatarProjectIds)
  await deleteByIds('video_clone_segments', 'project_id', videoCloneProjectIds)

  if (creatorSourceIds.length > 0 || productIds.length > 0) {
    const filters = [
      `user_id.eq.${userId}`,
      ...creatorSourceIds.map((id) => `creator_source_id.eq.${id}`),
      ...productIds.map((id) => `product_id.eq.${id}`),
    ]

    const { error: motionCloneError } = await supabase
      .from('motion_clone_projects')
      .delete()
      .or(filters.join(','))

    if (motionCloneError) {
      throw new Error(`Failed to delete motion_clone_projects for ${userId}: ${motionCloneError.message}`)
    }
  } else {
    await deleteByUserId('motion_clone_projects', userId)
  }

  await deleteByIds('creator_source_platforms', 'source_id', creatorSourceIds)
  await deleteByIds('creator_source_videos', 'source_id', creatorSourceIds)
  await deleteByUserId('creator_source_platforms', userId)
  await deleteByUserId('creator_source_videos', userId)
  await deleteByUserId('creator_sources', userId)
  await deleteByUserId('avatar_ads_projects', userId)
  await deleteByUserId('video_clone_projects', userId)
  await deleteByUserId('reference_videos', userId)
  await deleteByUserId('user_tiktok_connections', userId)
  await deleteByUserId('user_avatars', userId)
  await deleteByUserId('user_product_photos', userId)
  await deleteByUserId('user_products', userId)
  await deleteByUserId('project_agent_sessions', userId)
  await deleteByUserId('subscription_events', userId)
  await deleteByUserId('user_subscriptions', userId)
  await deleteByUserId('credit_transactions', userId)
  await deleteByUserId('user_credits', userId)

  return {
    removedStorageObjects: storageRefs.size,
    avatarProjectCount: avatarProjectIds.length,
    videoCloneProjectCount: videoCloneProjectIds.length,
    creatorSourceCount: creatorSourceIds.length,
    productCount: productIds.length,
  }
}
