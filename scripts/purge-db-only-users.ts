import 'dotenv/config'

import { createClient } from '@supabase/supabase-js'

const TARGET_USERS = [
  'user_31ojOKFgPhHtd5HPosAZb9G8JP7',
  'user_31rUKaYJ2jwDWIvpx7Iz3yFLPdh',
  'user_32MyFVog7bTzqLxuD2NKko4DCcH',
  'user_36Dze6DEjLe5LaO33nj9wbG0GRc',
  'user_37kTF16dNMSlg3WAtijr7MS1kZo',
  'user_37ky51qtKUnhQtRTzDdJ5rPH9G8',
] as const

const PUBLIC_URL_PATTERN = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

type StorageRef = {
  bucket: string
  path: string
  source: string
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function parseStorageRefFromPublicUrl(publicUrl: string | null | undefined) {
  if (!publicUrl) {
    return null
  }

  const match = publicUrl.match(PUBLIC_URL_PATTERN)
  if (!match) {
    return null
  }

  return {
    bucket: decodeURIComponent(match[1]),
    path: decodeURIComponent(match[2]),
  }
}

function collectStorageRefsFromJson(value: Json, source: string, refs: Map<string, StorageRef>) {
  if (typeof value === 'string') {
    const ref = parseStorageRefFromPublicUrl(value)
    if (ref) {
      refs.set(`${ref.bucket}:${ref.path}`, { ...ref, source })
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStorageRefsFromJson(item, source, refs)
    }
    return
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectStorageRefsFromJson(nested, source, refs)
    }
  }
}

function addStorageRef(
  refs: Map<string, StorageRef>,
  source: string,
  options: { bucket?: string | null; path?: string | null; publicUrl?: string | null }
) {
  if (options.bucket && options.path) {
    refs.set(`${options.bucket}:${options.path}`, {
      bucket: options.bucket,
      path: options.path,
      source,
    })
    return
  }

  const ref = parseStorageRefFromPublicUrl(options.publicUrl)
  if (!ref) {
    return
  }

  refs.set(`${ref.bucket}:${ref.path}`, { ...ref, source })
}

async function fetchIds(table: string, column: string) {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .in('user_id', [...TARGET_USERS])

  if (error) {
    throw new Error(`Failed to fetch ${table}.${column}: ${error.message}`)
  }

  return (data ?? [])
    .map((row) => row[column as keyof typeof row])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

async function deleteByUserIds(table: string) {
  const { error } = await supabase.from(table).delete().in('user_id', [...TARGET_USERS])
  if (error) {
    throw new Error(`Failed to delete from ${table}: ${error.message}`)
  }
}

async function deleteByIds(table: string, column: string, ids: string[]) {
  if (ids.length === 0) {
    return
  }

  const { error } = await supabase.from(table).delete().in(column, ids)
  if (error) {
    throw new Error(`Failed to delete from ${table} by ${column}: ${error.message}`)
  }
}

async function countByUserIds(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .in('user_id', [...TARGET_USERS])

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`)
  }

  return count ?? 0
}

async function countTable(table: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (error) {
    throw new Error(`Failed to count table ${table}: ${error.message}`)
  }

  return count ?? 0
}

async function deleteStorageRefs(refs: Map<string, StorageRef>) {
  let removed = 0

  for (const ref of refs.values()) {
    const { error } = await supabase.storage.from(ref.bucket).remove([ref.path])
    if (error) {
      throw new Error(`Failed to delete storage object ${ref.bucket}/${ref.path}: ${error.message}`)
    }
    removed += 1
  }

  return removed
}

async function main() {
  const beforeUserCredits = await countTable('user_credits')

  const avatarProjectIds = await fetchIds('avatar_ads_projects', 'id')
  const competitorProjectIds = await fetchIds('video_clone_projects', 'id')
  const productIds = await fetchIds('user_products', 'id')
  const creatorSourceIds = await fetchIds('creator_sources', 'id')

  const storageRefs = new Map<string, StorageRef>()

  const { data: avatars, error: avatarError } = await supabase
    .from('user_avatars')
    .select('id, user_id, storage_bucket, storage_path, photo_url, photo_set_json')
    .in('user_id', [...TARGET_USERS])

  if (avatarError) {
    throw new Error(`Failed to load user_avatars: ${avatarError.message}`)
  }

  for (const avatar of avatars ?? []) {
    addStorageRef(storageRefs, `user_avatars:${avatar.id}`, {
      bucket: avatar.storage_bucket,
      path: avatar.storage_path,
      publicUrl: avatar.photo_url,
    })

    if (avatar.photo_set_json) {
      collectStorageRefsFromJson(avatar.photo_set_json as Json, `user_avatars:${avatar.id}:photo_set_json`, storageRefs)
    }
  }

  const { data: productPhotos, error: photoError } = await supabase
    .from('user_product_photos')
    .select('id, user_id, storage_bucket, storage_path, photo_url, original_photo_url')
    .in('user_id', [...TARGET_USERS])

  if (photoError) {
    throw new Error(`Failed to load user_product_photos: ${photoError.message}`)
  }

  for (const photo of productPhotos ?? []) {
    addStorageRef(storageRefs, `user_product_photos:${photo.id}`, {
      bucket: photo.storage_bucket,
      path: photo.storage_path,
      publicUrl: photo.photo_url,
    })
    addStorageRef(storageRefs, `user_product_photos:${photo.id}:original`, {
      publicUrl: photo.original_photo_url,
    })
  }

  const { data: creatorVideos, error: creatorVideoError } = await supabase
    .from('creator_source_videos')
    .select('id, user_id, storage_bucket, storage_path, video_url, video_cdn_url, cover_storage_bucket, cover_storage_path, cover_url')
    .in('user_id', [...TARGET_USERS])

  if (creatorVideoError) {
    throw new Error(`Failed to load creator_source_videos: ${creatorVideoError.message}`)
  }

  for (const video of creatorVideos ?? []) {
    addStorageRef(storageRefs, `creator_source_videos:${video.id}:video`, {
      bucket: video.storage_bucket,
      path: video.storage_path,
      publicUrl: video.video_cdn_url || video.video_url,
    })
    addStorageRef(storageRefs, `creator_source_videos:${video.id}:cover`, {
      bucket: video.cover_storage_bucket,
      path: video.cover_storage_path,
      publicUrl: video.cover_url,
    })
  }

  const { data: referenceVideos, error: referenceVideosError } = await supabase
    .from('reference_videos')
    .select('id, user_id, source_storage_bucket, source_storage_path')
    .in('user_id', [...TARGET_USERS])

  if (referenceVideosError) {
    throw new Error(`Failed to load reference_videos: ${referenceVideosError.message}`)
  }

  for (const ad of referenceVideos ?? []) {
    addStorageRef(storageRefs, `reference_videos:${ad.id}`, {
      bucket: ad.source_storage_bucket,
      path: ad.source_storage_path,
    })
  }

  console.log(`Target users: ${TARGET_USERS.length}`)
  console.log(`Storage refs to remove: ${storageRefs.size}`)
  console.log(`User credits before purge: ${beforeUserCredits}`)

  const removedStorageCount = await deleteStorageRefs(storageRefs)
  console.log(`Removed storage refs: ${removedStorageCount}`)

  await deleteByIds('avatar_ads_scenes', 'project_id', avatarProjectIds)
  await deleteByIds('video_clone_segments', 'project_id', competitorProjectIds)

  if (creatorSourceIds.length > 0 || productIds.length > 0) {
    const { error: motionCloneError } = await supabase
      .from('motion_clone_projects')
      .delete()
      .or([
        `user_id.in.(${TARGET_USERS.join(',')})`,
        creatorSourceIds.length > 0 ? `creator_source_id.in.(${creatorSourceIds.join(',')})` : null,
        productIds.length > 0 ? `product_id.in.(${productIds.join(',')})` : null,
      ].filter(Boolean).join(','))

    if (motionCloneError) {
      throw new Error(`Failed to delete motion_clone_projects: ${motionCloneError.message}`)
    }
  } else {
    await deleteByUserIds('motion_clone_projects')
  }

  await deleteByIds('creator_source_platforms', 'source_id', creatorSourceIds)
  await deleteByIds('creator_source_videos', 'source_id', creatorSourceIds)
  await deleteByUserIds('creator_source_platforms')
  await deleteByUserIds('creator_source_videos')
  await deleteByUserIds('creator_sources')

  await deleteByUserIds('avatar_ads_projects')
  await deleteByUserIds('video_clone_projects')
  await deleteByUserIds('reference_videos')
  await deleteByUserIds('user_tiktok_connections')
  await deleteByUserIds('user_avatars')
  await deleteByUserIds('user_product_photos')
  await deleteByUserIds('user_products')
  await deleteByUserIds('project_agent_sessions')
  await deleteByUserIds('subscription_events')
  await deleteByUserIds('user_subscriptions')
  await deleteByUserIds('credit_transactions')
  await deleteByUserIds('user_credits')

  const afterUserCredits = await countTable('user_credits')
  const residualCounts = {
    user_credits: await countByUserIds('user_credits'),
    credit_transactions: await countByUserIds('credit_transactions'),
    user_subscriptions: await countByUserIds('user_subscriptions'),
    subscription_events: await countByUserIds('subscription_events'),
    user_avatars: await countByUserIds('user_avatars'),
    user_products: await countByUserIds('user_products'),
    user_product_photos: await countByUserIds('user_product_photos'),
    user_tiktok_connections: await countByUserIds('user_tiktok_connections'),
    reference_videos: await countByUserIds('reference_videos'),
    video_clone_projects: await countByUserIds('video_clone_projects'),
    avatar_ads_projects: await countByUserIds('avatar_ads_projects'),
    project_agent_sessions: await countByUserIds('project_agent_sessions'),
    creator_sources: await countByUserIds('creator_sources'),
    creator_source_platforms: await countByUserIds('creator_source_platforms'),
    creator_source_videos: await countByUserIds('creator_source_videos'),
    motion_clone_projects: await countByUserIds('motion_clone_projects'),
  }

  console.log(JSON.stringify({
    removedStorageCount,
    beforeUserCredits,
    afterUserCredits,
    residualCounts,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
