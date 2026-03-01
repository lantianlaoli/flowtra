import 'dotenv/config'

import { createClient } from '@supabase/supabase-js'

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

const bucket = 'site-assets'
const basePath = 'showcase/shared/videos'

const renameMap = {
  'asset.mp4': 'avatar_ads_asset.mp4',
  'avatar-ads.mp4': 'avatar_ads_demo.mp4',
  'character-ad-case-1.mp4': 'character_ads_case.mp4',
  'clone-video-image-prompt.mp4': 'clone_prompt_image.mp4',
  'clone-video-video-promp.mp4': 'clone_prompt_video.mp4',
  'clone_competitor_origin.mp4': 'clone_competitor_source.mp4',
  'clone_competitor_parse.mp4': 'clone_competitor_parse.mp4',
  'clone_competitor_result.mp4': 'clone_competitor_result.mp4',
  'import-paths.mp4': 'import_video_paths.mp4',
  'import-tiktok-name.mp4': 'import_tiktok_name.mp4',
  'motion-swap.mp4': 'motion_swap_demo.mp4',
  'motion_swap_refer_1.mp4': 'motion_swap_refer.mp4',
  'motion_swap_result_1.mp4': 'motion_swap_result.mp4',
} as const

async function moveObject(fromName: string, toName: string) {
  if (fromName === toName) {
    return
  }

  const sourcePath = `${basePath}/${fromName}`
  const targetPath = `${basePath}/${toName}`

  const { data, error } = await supabase.storage.from(bucket).download(sourcePath)
  if (error || !data) {
    throw new Error(`Failed to download ${sourcePath}: ${error?.message || 'Unknown error'}`)
  }

  const arrayBuffer = await data.arrayBuffer()
  const contentType = data.type || 'video/mp4'

  const { error: uploadError } = await supabase.storage.from(bucket).upload(targetPath, arrayBuffer, {
    upsert: true,
    contentType,
    cacheControl: '3600'
  })

  if (uploadError) {
    throw new Error(`Failed to upload ${targetPath}: ${uploadError.message}`)
  }

  const { error: removeError } = await supabase.storage.from(bucket).remove([sourcePath])
  if (removeError) {
    throw new Error(`Failed to remove ${sourcePath}: ${removeError.message}`)
  }

  console.log(`${fromName} -> ${toName}`)
}

async function main() {
  for (const [fromName, toName] of Object.entries(renameMap)) {
    await moveObject(fromName, toName)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
