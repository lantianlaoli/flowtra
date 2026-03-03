import 'dotenv/config'

import { createClient } from '@supabase/supabase-js'

import { STORAGE_BUCKETS } from '../lib/storage/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const publicPrefix = `${supabaseUrl}/storage/v1/object/public/`
const storageObjectPrefix = `${supabaseUrl}/storage/v1/object/`

const hardcodedAssets = [
  'images/features_videos/character-ad-case-1.mp4',
  'images/features_images/character-ad-config.png',
  'images/features_videos/asset.mp4',
  'images/features_videos/avatar-ads.mp4',
  'images/landing_page/user_avatar_1.jpg',
  'images/landing_page/user_avatar_2.png',
  'images/landing_page/user_avatar_3.png',
  'images/landing_page/user_standard_product_1.jpg',
  'images/landing_page/user_standard_case_1.mp4',
  'images/landing_page/user_character_human_case_1.png',
  'images/landing_page/user_character_product_case_1.jpg',
  'images/landing_page/user_character_video_case_1.mp4',
  'images/landing_page/clone_reference.mp4',
  'images/landing_page/clone_result.mp4',
  'images/features_videos/clone_competitor_origin.mp4',
  'images/features_videos/clone_competitor_result.mp4',
  'images/features_videos/clone_competitor_parse.mp4',
  'images/features_videos/clone-video-image-prompt.mp4',
  'images/features_videos/clone-video-video-promp.mp4',
  'images/features_videos/competitor_ugc_replication_1_video.mp4',
  'images/features_videos/competitor_ugc_replication_2_video.mp4',
  'images/features_images/competitor_ugc_replication_1_product.jpg',
  'images/features_images/competitor_ugc_replication_2_product.png',
  'images/features_videos/motion_swap_refer_1.mp4',
  'images/features_videos/motion_swap_result_1.mp4',
  'images/features_videos/import-paths.mp4',
  'images/features_videos/import-tiktok-name.mp4',
  'images/features_videos/motion-swap.mp4',
  'images/user-photos/user_default_male.png',
  'images/user-photos/user_default_female.png',
  'images/user-photos/user_default_founder.png',
  'images/user-photos/character_ad_example.png',
  'competitor_videos/user-photos/character_ad_bad.png',
  'images/other/founder.png',
] as const

const listAllStorageObjects = async (bucket: string, prefix: string) => {
  const results: string[] = []
  let offset = 0
  const pageSize = 100

  while (true) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, {
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' }
      })

    if (error) {
      throw new Error(`Failed to list ${bucket}/${prefix}: ${error.message}`)
    }

    if (!data || data.length === 0) {
      break
    }

    for (const item of data) {
      if (item.name) {
        results.push(`${prefix}/${item.name}`)
      }
    }

    if (data.length < pageSize) {
      break
    }

    offset += data.length
  }

  return results
}

const parseRef = (value: string) => {
  const normalized = value.startsWith(publicPrefix) ? value.slice(publicPrefix.length) : value
  const slashIndex = normalized.indexOf('/')
  return {
    bucket: normalized.slice(0, slashIndex),
    path: normalized.slice(slashIndex + 1),
  }
}

const mapDestinationPath = (bucket: string, path: string) => {
  if (bucket === 'images' && path.startsWith('blog_covers/')) {
    return `blog/covers/${path.slice('blog_covers/'.length)}`
  }
  if (bucket === 'images' && path.startsWith('blog_images/')) {
    return `blog/media/legacy/${path.slice('blog_images/'.length)}`
  }
  if (bucket === 'images' && path.startsWith('landing_page/')) {
    return `landing/${path.slice('landing_page/'.length)}`
  }
  if (bucket === 'images' && path.startsWith('features_images/')) {
    return `showcase/shared/images/${path.slice('features_images/'.length)}`
  }
  if (bucket === 'images' && path.startsWith('features_videos/')) {
    return `showcase/shared/videos/${path.slice('features_videos/'.length)}`
  }
  if (path.startsWith('user-photos/')) {
    const fileName = path.slice('user-photos/'.length)
    if (fileName.startsWith('user_default_')) {
      return `defaults/avatars/${fileName}`
    }
    return `examples/avatar-quality/${fileName}`
  }
  if (bucket === 'images' && path.startsWith('other/')) {
    return `showcase/other/${path.slice('other/'.length)}`
  }
  return `legacy/${bucket}/${path}`
}

const fetchDistinctArticleAssets = async () => {
  const { data, error } = await supabase
    .from('articles')
    .select('cover,og_image')

  if (error) {
    throw new Error(`Failed to load article assets: ${error.message}`)
  }

  const assets = new Set<string>()
  for (const row of data || []) {
    for (const value of [row.cover, row.og_image]) {
      if (typeof value !== 'string') {
        continue
      }

      if (value.includes('/storage/v1/object/public/images/')) {
        assets.add(value)
        continue
      }

      if (value.includes('/storage/v1/object/public/site-assets/blog/covers/')) {
        assets.add(value.replace('/storage/v1/object/public/site-assets/blog/covers/', '/storage/v1/object/public/images/blog_covers/'))
        continue
      }

      if (value.includes('/storage/v1/object/public/site-assets/blog/media/legacy/')) {
        assets.add(value.replace('/storage/v1/object/public/site-assets/blog/media/legacy/', '/storage/v1/object/public/images/blog_images/'))
      }
    }
  }

  return [...assets]
}

const fetchActiveArticleCoverPaths = async () => {
  const { data, error } = await supabase
    .from('articles')
    .select('cover,og_image')

  if (error) {
    throw new Error(`Failed to load article cover references: ${error.message}`)
  }

  const activeSiteAssetCovers = new Set<string>()
  const activeLegacyImageCovers = new Set<string>()

  for (const row of data || []) {
    for (const value of [row.cover, row.og_image]) {
      if (typeof value !== 'string') {
        continue
      }

      const ref = parseRef(value)
      if (!ref.bucket || !ref.path) {
        continue
      }

      if (ref.bucket === STORAGE_BUCKETS.siteAssets && ref.path.startsWith('blog/covers/')) {
        activeSiteAssetCovers.add(ref.path)
      }

      if (ref.bucket === 'images' && ref.path.startsWith('blog_covers/')) {
        activeLegacyImageCovers.add(ref.path)
      }
    }
  }

  return {
    activeSiteAssetCovers,
    activeLegacyImageCovers,
  }
}

const fetchLegacyBlogAssets = async () => {
  const [imageBlogCovers, imageBlogMedia, imageBlogVideos, competitorBlogCovers] = await Promise.all([
    listAllStorageObjects('images', 'blog_covers'),
    listAllStorageObjects('images', 'blog_images'),
    listAllStorageObjects('images', 'blog_videos'),
    listAllStorageObjects('competitor_videos', 'blog_covers'),
  ])

  return [
    ...imageBlogCovers.map(path => `images/${path}`),
    ...imageBlogMedia.map(path => `images/${path}`),
    ...imageBlogVideos.map(path => `images/${path}`),
    ...competitorBlogCovers.map(path => `competitor_videos/${path}`),
  ]
}

const copyObject = async (bucket: string, path: string, destinationPath: string) => {
  const response = await fetch(`${storageObjectPrefix}${bucket}/${path}`, {
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
    },
    signal: AbortSignal.timeout(30000)
  })

  if (!response.ok) {
    console.warn(`[known-site-assets] Skipping missing ${bucket}/${path}: ${response.status}`)
    return false
  }

  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || undefined

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.siteAssets)
    .upload(destinationPath, arrayBuffer, {
      upsert: true,
      contentType,
      cacheControl: '3600'
    })

  if (uploadError) {
    throw new Error(`Failed to upload site asset ${destinationPath}: ${uploadError.message}`)
  }

  return true
}

const removeObjects = async (bucket: string, paths: string[]) => {
  if (paths.length === 0) {
    return 0
  }

  let removed = 0

  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100)
    const { error } = await supabase.storage.from(bucket).remove(chunk)

    if (error) {
      throw new Error(`Failed to remove ${bucket} objects: ${error.message}`)
    }

    removed += chunk.length
  }

  return removed
}

const pruneOrphanedArticleCovers = async () => {
  const { activeSiteAssetCovers, activeLegacyImageCovers } = await fetchActiveArticleCoverPaths()
  const [siteAssetCovers, legacyImageCovers] = await Promise.all([
    listAllStorageObjects(STORAGE_BUCKETS.siteAssets, 'blog/covers'),
    listAllStorageObjects('images', 'blog_covers'),
  ])

  const orphanedSiteAssetCovers = siteAssetCovers.filter(path => !activeSiteAssetCovers.has(path))
  const orphanedLegacyImageCovers = legacyImageCovers.filter(path => !activeLegacyImageCovers.has(path))

  const [removedSiteAssetCovers, removedLegacyImageCovers] = await Promise.all([
    removeObjects(STORAGE_BUCKETS.siteAssets, orphanedSiteAssetCovers),
    removeObjects('images', orphanedLegacyImageCovers),
  ])

  console.table({
    activeSiteAssetCovers: activeSiteAssetCovers.size,
    activeLegacyImageCovers: activeLegacyImageCovers.size,
    removedSiteAssetCovers,
    removedLegacyImageCovers,
  })
}

async function main() {
  const blogOnly = process.argv.includes('--blog-only')
  const articleAssetsOnly = process.argv.includes('--article-assets-only')
  const pruneOrphanedCovers = process.argv.includes('--prune-orphaned-covers')

  if (pruneOrphanedCovers) {
    await pruneOrphanedArticleCovers()
    return
  }

  const [articleAssets, legacyBlogAssets] = await Promise.all([
    fetchDistinctArticleAssets(),
    fetchLegacyBlogAssets()
  ])
  const candidates = articleAssetsOnly
    ? [...new Set(articleAssets)]
    : blogOnly
    ? [...new Set([...articleAssets, ...legacyBlogAssets])]
    : [...new Set([...hardcodedAssets, ...articleAssets, ...legacyBlogAssets])]

  let migrated = 0
  let skipped = 0

  for (const candidate of candidates) {
    const { bucket, path } = parseRef(candidate)
    const destinationPath = mapDestinationPath(bucket, path)
    const copied = await copyObject(bucket, path, destinationPath)
    if (copied) {
      migrated += 1
    } else {
      skipped += 1
    }
  }

  console.table({
    migrated,
    skipped,
    blogOnly,
    articleAssetsOnly,
    articleAssets: articleAssets.length,
    legacyBlogAssets: legacyBlogAssets.length,
    bucket: STORAGE_BUCKETS.siteAssets
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
