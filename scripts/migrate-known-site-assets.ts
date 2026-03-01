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
    if (typeof row.cover === 'string' && row.cover.includes('/storage/v1/object/public/images/')) {
      assets.add(row.cover)
    }
    if (typeof row.og_image === 'string' && row.og_image.includes('/storage/v1/object/public/images/')) {
      assets.add(row.og_image)
    }
  }

  return [...assets]
}

const copyObject = async (bucket: string, path: string, destinationPath: string) => {
  const response = await fetch(`${publicPrefix}${bucket}/${path}`, {
    signal: AbortSignal.timeout(30000)
  })

  if (!response.ok) {
    console.warn(`[known-site-assets] Skipping missing ${bucket}/${path}: ${response.status}`)
    return false
  }

  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || undefined

  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS.siteAssets)
    .upload(destinationPath, arrayBuffer, {
      upsert: true,
      contentType,
      cacheControl: '3600'
    })

  if (error) {
    throw new Error(`Failed to upload site asset ${destinationPath}: ${error.message}`)
  }

  return true
}

async function main() {
  const articleAssets = await fetchDistinctArticleAssets()
  const candidates = [...new Set([...hardcodedAssets, ...articleAssets])]

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
    bucket: STORAGE_BUCKETS.siteAssets
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
