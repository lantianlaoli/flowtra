import 'dotenv/config'

import { createClient } from '@supabase/supabase-js'

import {
  buildCreatorVideoPath,
  buildSiteAssetPath,
  buildUserAvatarImagePath,
  buildUserProductPhotoPath,
  getFileExtension,
} from '../lib/storage/paths'
import { STORAGE_BUCKETS } from '../lib/storage/types'

type LegacyBucket = 'images' | 'competitor_videos'

type PublicRef = {
  bucket: string
  path: string
}

type AvatarPhotoSet = {
  primary: {
    photo_url: string
    file_name: string
  }
  references: Array<{
    photo_url: string
    file_name: string
    tag?: 'angle_45' | 'profile_or_detail' | 'custom'
  }>
  updated_at: string
}

type UserAvatarRow = {
  id: string
  user_id: string
  photo_url: string
  file_name: string
  photo_set_json: AvatarPhotoSet | null
}

type UserProductPhotoRow = {
  id: string
  user_id: string
  product_id: string | null
  photo_url: string
  file_name: string
  original_photo_url: string | null
}

type CreatorSourceVideoRow = {
  id: string
  user_id: string
  video_url: string
  video_cdn_url: string | null
  cover_url: string | null
}

type StorageListItem = {
  name: string
  id: string | null
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be configured before running storage migration.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const publicUrlPrefix = `${supabaseUrl}/storage/v1/object/public/`

const counters = {
  avatars: 0,
  productPhotos: 0,
  creatorVideos: 0,
  creatorCovers: 0,
  staticAssets: 0,
  archivedLegacyVideos: 0,
  deletedBrandObjects: 0,
  skipped: 0,
}

const copiedDestinations = new Set<string>()

const parsePublicRef = (value: string | null | undefined): PublicRef | null => {
  if (!value || !value.startsWith(publicUrlPrefix)) {
    return null
  }

  const remainder = value.slice(publicUrlPrefix.length)
  const separatorIndex = remainder.indexOf('/')
  if (separatorIndex === -1) {
    return null
  }

  return {
    bucket: remainder.slice(0, separatorIndex),
    path: remainder.slice(separatorIndex + 1),
  }
}

const buildPublicUrl = (bucket: string, path: string) =>
  `${publicUrlPrefix}${bucket}/${path}`

const normalizeAvatarPhotoSet = (row: UserAvatarRow): AvatarPhotoSet => {
  const candidate = row.photo_set_json
  return {
    primary: {
      photo_url: candidate?.primary?.photo_url || row.photo_url,
      file_name: candidate?.primary?.file_name || row.file_name || 'avatar_primary'
    },
    references: Array.isArray(candidate?.references)
      ? candidate.references
          .filter((item) => typeof item?.photo_url === 'string')
          .map((item) => ({
            photo_url: item.photo_url,
            file_name: item.file_name || 'avatar_reference',
            tag: item.tag === 'angle_45' || item.tag === 'profile_or_detail' || item.tag === 'custom'
              ? item.tag
              : 'custom'
          }))
      : [],
    updated_at: candidate?.updated_at || new Date().toISOString()
  }
}

const listAllObjects = async (bucket: string, prefix = ''): Promise<string[]> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(prefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    })

  if (error) {
    throw new Error(`Failed to list ${bucket}/${prefix}: ${error.message}`)
  }

  const items = data as StorageListItem[]
  const files: string[] = []

  for (const item of items) {
    const nextPath = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) {
      files.push(...await listAllObjects(bucket, nextPath))
      continue
    }
    files.push(nextPath)
  }

  return files
}

const copyObject = async (sourceBucket: string, sourcePath: string, destBucket: string, destPath: string) => {
  const destinationKey = `${destBucket}/${destPath}`
  if (copiedDestinations.has(destinationKey)) {
    return buildPublicUrl(destBucket, destPath)
  }

  const { data, error } = await supabase.storage
    .from(sourceBucket)
    .download(sourcePath)

  let arrayBuffer: ArrayBuffer | null = null
  let contentType: string | undefined

  if (data) {
    arrayBuffer = await data.arrayBuffer()
    contentType = data.type || undefined
  }

  if (!arrayBuffer) {
    const publicResponse = await fetch(buildPublicUrl(sourceBucket, sourcePath))
    if (!publicResponse.ok) {
      throw new Error(`Failed to download ${sourceBucket}/${sourcePath}: ${error?.message || publicResponse.statusText || 'Unknown error'}`)
    }
    arrayBuffer = await publicResponse.arrayBuffer()
    contentType = publicResponse.headers.get('content-type') || undefined
  }

  const { error: uploadError } = await supabase.storage
    .from(destBucket)
    .upload(destPath, arrayBuffer, {
      upsert: true,
      contentType,
      cacheControl: '3600'
    })

  if (uploadError) {
    throw new Error(`Failed to upload ${destBucket}/${destPath}: ${uploadError.message}`)
  }

  copiedDestinations.add(destinationKey)
  return buildPublicUrl(destBucket, destPath)
}

const safeCopyObject = async (sourceBucket: string, sourcePath: string, destBucket: string, destPath: string) => {
  try {
    return await copyObject(sourceBucket, sourcePath, destBucket, destPath)
  } catch (error) {
    console.warn(`[storage-migrate] Skipping missing object ${sourceBucket}/${sourcePath}:`, error)
    counters.skipped += 1
    return null
  }
}

const moveAvatarAssets = async () => {
  const { data, error } = await supabase
    .from('user_avatars')
    .select('id,user_id,photo_url,file_name,photo_set_json')

  if (error) {
    throw new Error(`Failed to load user_avatars: ${error.message}`)
  }

  for (const row of (data || []) as UserAvatarRow[]) {
    const photoSet = normalizeAvatarPhotoSet(row)
    const primaryRef = parsePublicRef(photoSet.primary.photo_url)
    const primaryExt = getFileExtension(photoSet.primary.file_name || primaryRef?.path || row.file_name, 'png')
    let nextPrimaryUrl = photoSet.primary.photo_url
    let storagePath: string | null = null

    if (primaryRef?.bucket === 'images') {
      storagePath = buildUserAvatarImagePath({
        userId: row.user_id,
        avatarId: row.id,
        extension: primaryExt
      })
      const copiedUrl = await safeCopyObject(primaryRef.bucket, primaryRef.path, STORAGE_BUCKETS.userImages, storagePath)
      if (copiedUrl) {
        nextPrimaryUrl = copiedUrl
        counters.avatars += 1
      } else {
        storagePath = null
      }
    }

    const nextReferences = await Promise.all(photoSet.references.map(async (reference, index) => {
      const referenceRef = parsePublicRef(reference.photo_url)
      if (!referenceRef || referenceRef.bucket !== 'images') {
        return reference
      }

      const referencePath = buildUserAvatarImagePath({
        userId: row.user_id,
        avatarId: row.id,
        extension: getFileExtension(reference.file_name || referenceRef.path, 'png'),
        referenceIndex: index
      })

      const migratedUrl = await safeCopyObject(referenceRef.bucket, referenceRef.path, STORAGE_BUCKETS.userImages, referencePath)
      if (!migratedUrl) {
        return reference
      }
      counters.avatars += 1
      return {
        ...reference,
        photo_url: migratedUrl
      }
    }))

    if (!storagePath && nextPrimaryUrl === photoSet.primary.photo_url && nextReferences.every((reference, index) => reference.photo_url === photoSet.references[index]?.photo_url)) {
      counters.skipped += 1
      continue
    }

    const nextPhotoSet: AvatarPhotoSet = {
      primary: {
        photo_url: nextPrimaryUrl,
        file_name: photoSet.primary.file_name
      },
      references: nextReferences,
      updated_at: new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('user_avatars')
      .update({
        photo_url: nextPrimaryUrl,
        file_name: photoSet.primary.file_name,
        storage_bucket: storagePath ? STORAGE_BUCKETS.userImages : null,
        storage_path: storagePath,
        photo_set_json: nextPhotoSet
      })
      .eq('id', row.id)

    if (updateError) {
      throw new Error(`Failed to update avatar ${row.id}: ${updateError.message}`)
    }
  }
}

const moveProductPhotos = async () => {
  const { data, error } = await supabase
    .from('user_product_photos')
    .select('id,user_id,product_id,photo_url,file_name,original_photo_url')

  if (error) {
    throw new Error(`Failed to load user_product_photos: ${error.message}`)
  }

  for (const row of (data || []) as UserProductPhotoRow[]) {
    const currentRef = parsePublicRef(row.photo_url)
    const originalRef = parsePublicRef(row.original_photo_url)
    const productId = row.product_id || 'temporary'
    let nextPhotoUrl = row.photo_url
    let nextOriginalPhotoUrl = row.original_photo_url
    let storagePath: string | null = null

    if (currentRef?.bucket === 'images') {
      const isPurifiedVariant = Boolean(originalRef && row.original_photo_url && row.original_photo_url !== row.photo_url)
      storagePath = buildUserProductPhotoPath({
        userId: row.user_id,
        productId,
        photoId: row.id,
        extension: getFileExtension(row.file_name || currentRef.path, 'png'),
        variant: isPurifiedVariant ? 'purified' : 'original'
      })
      const copiedUrl = await safeCopyObject(currentRef.bucket, currentRef.path, STORAGE_BUCKETS.userImages, storagePath)
      if (copiedUrl) {
        nextPhotoUrl = copiedUrl
        counters.productPhotos += 1
      } else {
        storagePath = null
      }
    }

    if (originalRef?.bucket === 'images') {
      const originalPath = buildUserProductPhotoPath({
        userId: row.user_id,
        productId,
        photoId: row.id,
        extension: getFileExtension(row.file_name || originalRef.path, 'png'),
        variant: 'original'
      })
      const copiedOriginalUrl = await safeCopyObject(originalRef.bucket, originalRef.path, STORAGE_BUCKETS.userImages, originalPath)
      if (copiedOriginalUrl) {
        nextOriginalPhotoUrl = copiedOriginalUrl
        counters.productPhotos += 1
      }
    }

    if (!storagePath && nextPhotoUrl === row.photo_url && nextOriginalPhotoUrl === row.original_photo_url) {
      counters.skipped += 1
      continue
    }

    const { error: updateError } = await supabase
      .from('user_product_photos')
      .update({
        photo_url: nextPhotoUrl,
        original_photo_url: nextOriginalPhotoUrl,
        storage_bucket: storagePath ? STORAGE_BUCKETS.userImages : null,
        storage_path: storagePath
      })
      .eq('id', row.id)

    if (updateError) {
      throw new Error(`Failed to update product photo ${row.id}: ${updateError.message}`)
    }
  }
}

const moveCreatorVideos = async () => {
  const { data, error } = await supabase
    .from('creator_source_videos')
    .select('id,user_id,video_url,video_cdn_url,cover_url')

  if (error) {
    throw new Error(`Failed to load creator_source_videos: ${error.message}`)
  }

  for (const row of (data || []) as CreatorSourceVideoRow[]) {
    const videoRef = parsePublicRef(row.video_cdn_url || row.video_url)
    const coverRef = parsePublicRef(row.cover_url)

    let nextVideoUrl = row.video_url
    let nextVideoCdnUrl = row.video_cdn_url
    let nextCoverUrl = row.cover_url
    let storagePath: string | null = null
    let coverStoragePath: string | null = null

    if (videoRef?.bucket === 'competitor_videos') {
      storagePath = buildCreatorVideoPath({
        userId: row.user_id,
        creatorVideoId: row.id,
        extension: getFileExtension(videoRef.path, 'mp4'),
        variant: 'source'
      })
      const migratedVideoUrl = await safeCopyObject(videoRef.bucket, videoRef.path, STORAGE_BUCKETS.userVideos, storagePath)
      if (migratedVideoUrl) {
        nextVideoCdnUrl = migratedVideoUrl
        if (parsePublicRef(row.video_url)?.bucket === 'competitor_videos') {
          nextVideoUrl = migratedVideoUrl
        }
        counters.creatorVideos += 1
      } else {
        storagePath = null
      }
    }

    if (coverRef?.bucket === 'competitor_videos') {
      coverStoragePath = buildCreatorVideoPath({
        userId: row.user_id,
        creatorVideoId: row.id,
        extension: getFileExtension(coverRef.path, 'png'),
        variant: 'cover'
      })
      const migratedCoverUrl = await safeCopyObject(coverRef.bucket, coverRef.path, STORAGE_BUCKETS.userImages, coverStoragePath)
      if (migratedCoverUrl) {
        nextCoverUrl = migratedCoverUrl
        counters.creatorCovers += 1
      } else {
        coverStoragePath = null
      }
    }

    if (!storagePath && !coverStoragePath) {
      counters.skipped += 1
      continue
    }

    const { error: updateError } = await supabase
      .from('creator_source_videos')
      .update({
        video_url: nextVideoUrl,
        video_cdn_url: nextVideoCdnUrl,
        cover_url: nextCoverUrl,
        storage_bucket: storagePath ? STORAGE_BUCKETS.userVideos : null,
        storage_path: storagePath,
        cover_storage_bucket: coverStoragePath ? STORAGE_BUCKETS.userImages : null,
        cover_storage_path: coverStoragePath
      })
      .eq('id', row.id)

    if (updateError) {
      throw new Error(`Failed to update creator source video ${row.id}: ${updateError.message}`)
    }
  }
}

const mapStaticAssetDestination = (bucket: LegacyBucket, path: string) => {
  const segments = path.split('/')
  const [prefix, ...rest] = segments
  const fileName = rest[rest.length - 1]
  const extension = getFileExtension(fileName, 'png')
  const restPath = rest.join('/')

  if (bucket === 'images' && prefix === 'blog_covers') {
    return {
      bucket: STORAGE_BUCKETS.siteAssets,
      path: `blog/covers/${restPath}`
    }
  }

  if (bucket === 'images' && (prefix === 'blog_images' || prefix === 'blog_videos')) {
    return {
      bucket: STORAGE_BUCKETS.siteAssets,
      path: `blog/media/legacy/${restPath}`
    }
  }

  if (bucket === 'images' && prefix === 'landing_page') {
    return {
      bucket: STORAGE_BUCKETS.siteAssets,
      path: `landing/${restPath}`
    }
  }

  if (bucket === 'images' && prefix === 'features_images') {
    return {
      bucket: STORAGE_BUCKETS.siteAssets,
      path: `showcase/shared/images/${restPath}`
    }
  }

  if (bucket === 'images' && prefix === 'features_videos') {
    return {
      bucket: STORAGE_BUCKETS.siteAssets,
      path: `showcase/shared/videos/${restPath}`
    }
  }

  if ((bucket === 'images' || bucket === 'competitor_videos') && prefix === 'user-photos') {
    if (fileName.includes('user_default_')) {
      return {
        bucket: STORAGE_BUCKETS.siteAssets,
        path: `defaults/avatars/${fileName}`
      }
    }

    return {
      bucket: STORAGE_BUCKETS.siteAssets,
      path: `examples/avatar-quality/${fileName}`
    }
  }

  if (bucket === 'competitor_videos' && prefix === 'blog_covers') {
    return {
      bucket: STORAGE_BUCKETS.siteAssets,
      path: `blog/covers/${restPath}`
    }
  }

  if (bucket === 'images' && prefix === 'other') {
    return {
      bucket: STORAGE_BUCKETS.siteAssets,
      path: buildSiteAssetPath({
        section: 'showcase',
        slug: 'other',
        assetName: fileName.replace(/\.[^.]+$/, ''),
        extension
      })
    }
  }

  if (bucket === 'competitor_videos' && (prefix === 'creator-videos' || prefix === 'creator-video-covers')) {
    return null
  }

  if (bucket === 'images' && (prefix === 'avatars' || prefix === 'product' || prefix === 'brands')) {
    return null
  }

  if (bucket === 'competitor_videos' && prefix.startsWith('temp_')) {
    return {
      bucket: STORAGE_BUCKETS.tempUploads,
      path: `legacy/competitor-videos/${path}`
    }
  }

  if (bucket === 'competitor_videos') {
    return {
      bucket: STORAGE_BUCKETS.userVideos,
      path: `legacy/competitor-videos/${path}`
    }
  }

  return {
    bucket: STORAGE_BUCKETS.siteAssets,
    path: `legacy/${bucket}/${path}`
  }
}

const moveStaticAssets = async () => {
  const legacyImages = await listAllObjects('images')
  const legacyCompetitorVideos = await listAllObjects('competitor_videos')

  for (const path of legacyImages) {
    if (path.startsWith('brands/')) {
      continue
    }

    const destination = mapStaticAssetDestination('images', path)
    if (!destination) {
      continue
    }

    const copied = await safeCopyObject('images', path, destination.bucket, destination.path)
    if (copied) {
      counters.staticAssets += 1
    }
  }

  for (const path of legacyCompetitorVideos) {
    const destination = mapStaticAssetDestination('competitor_videos', path)
    if (!destination) {
      continue
    }

    const copied = await safeCopyObject('competitor_videos', path, destination.bucket, destination.path)
    if (copied) {
      if (destination.path.startsWith('legacy/competitor-videos/')) {
        counters.archivedLegacyVideos += 1
      } else {
        counters.staticAssets += 1
      }
    }
  }
}

const deleteBrandObjects = async () => {
  const brandObjects = (await listAllObjects('images')).filter((path) => path.startsWith('brands/'))
  if (brandObjects.length === 0) {
    return
  }

  for (let index = 0; index < brandObjects.length; index += 100) {
    const chunk = brandObjects.slice(index, index + 100)
    const { error } = await supabase.storage.from('images').remove(chunk)
    if (error) {
      throw new Error(`Failed to delete brand objects: ${error.message}`)
    }
    counters.deletedBrandObjects += chunk.length
  }
}

async function main() {
  console.log('Starting legacy storage migration into canonical buckets...')

  await moveAvatarAssets()
  await moveProductPhotos()
  await moveCreatorVideos()
  await moveStaticAssets()
  await deleteBrandObjects()

  const [siteAssetCount, userImageCount, userVideoCount, tempUploadCount] = await Promise.all([
    listAllObjects(STORAGE_BUCKETS.siteAssets).then((items) => items.length),
    listAllObjects(STORAGE_BUCKETS.userImages).then((items) => items.length),
    listAllObjects(STORAGE_BUCKETS.userVideos).then((items) => items.length),
    listAllObjects(STORAGE_BUCKETS.tempUploads).then((items) => items.length),
  ])

  console.log('Storage migration complete.')
  console.table(counters)
  console.table({
    'site-assets': siteAssetCount,
    'user-images': userImageCount,
    'user-videos': userVideoCount,
    'temp-uploads': tempUploadCount,
  })
}

main().catch((error) => {
  console.error('Storage migration failed:', error)
  process.exit(1)
})
