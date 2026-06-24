import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Buffer } from 'buffer'
import {
  buildAvatarAdsDraftUploadPath,
  buildCreatorVideoPath,
  buildTempProductPhotoPath,
  buildToolTempUploadPath,
  buildUserAvatarImagePath,
  buildUserPetPhotoPath,
  buildUserProductPhotoPath,
  getFileExtension,
} from '@/lib/storage/paths'
import {
  buildStorageRef,
  removeStorageObject,
  removeStorageObjectByUrl,
  removeStorageObjectWithFallback,
} from '@/lib/storage/ops'
import { STORAGE_BUCKETS, type StorageBucket } from '@/lib/storage/types'
import type { PersistedVideoQuality } from '@/lib/constants'
// Lazily initialize clients to avoid evaluating env vars during build time
let browserClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

declare global {
  var __flowtraBrowserSupabaseClient: SupabaseClient | undefined
  var __flowtraServiceSupabaseClient: SupabaseClient | undefined
}

// Public/browser client only. Do not use this for authenticated server-side access to private tables.
export function getSupabase(): SupabaseClient {
  if (typeof globalThis !== 'undefined' && globalThis.__flowtraBrowserSupabaseClient) {
    return globalThis.__flowtraBrowserSupabaseClient
  }
  if (browserClient) return browserClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public URL or anon key is not configured')
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey)
  if (typeof globalThis !== 'undefined') {
    globalThis.__flowtraBrowserSupabaseClient = browserClient
  }
  return browserClient
}

// Service role client for bypassing RLS (server-only)
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof globalThis !== 'undefined' && globalThis.__flowtraServiceSupabaseClient) {
    return globalThis.__flowtraServiceSupabaseClient
  }
  if (serviceClient) return serviceClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase service role configuration is missing')
  }

  serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  if (typeof globalThis !== 'undefined') {
    globalThis.__flowtraServiceSupabaseClient = serviceClient
  }
  return serviceClient
}

// Database types for user_credits table
export interface UserCredits {
  id: string
  user_id: string
  credits_remaining: number
  creem_id?: string
  created_at: string
  updated_at: string
}

// Database types for articles table
export interface Article {
  id: string
  title: string
  slug: string
  content: string
  cover?: string
  created_at: string
  meta_description?: string // Custom meta description for SEO (overrides auto-generated excerpt)
  keywords?: string[] // Article-specific keywords for SEO
  og_image?: string // Custom Open Graph image URL (overrides default)
}

// Database types for single_video_projects table (now video_clone_projects)
export interface SingleVideoProject {
  id: string
  user_id: string
  video_url?: string
  video_prompts?: Record<string, unknown>
  image_prompt?: Record<string, unknown> // JSONB field containing the prompt used for cover generation
  video_model: 'seedance_2_fast' | 'seedance_2' | 'seedance_2_mini' | 'kling_3' | 'wan_27'
  credits_cost: number
  status: 'processing' | 'completed' | 'failed' | 'upload_complete' | 'description_complete' | 'prompts_complete' | 'cover_complete'
  error_message?: string
  language?: string | null // Preferred language code for prompts and narration
  photo_only?: boolean // If true, workflow skips video generation and only produces a cover image
  downloaded?: boolean // Whether user has downloaded the video
  download_credits_used?: number // DEPRECATED: Credits used for downloading (no longer applicable, downloads are free)
  video_task_id?: string | null
  current_step?: 'describing' | 'generating_prompts' | 'generating_cover' | 'generating_video' | 'completed'
  progress_percentage?: number
  last_processed_at?: string
  selected_inputs?: VideoCloneSelectedInputs | null // Multi-selection context (primary + arrays)
  product_image_urls?: string[] | null
  video_generation_requested?: boolean | null // Whether user approved moving from cover to video
  video_aspect_ratio?: string // Video aspect ratio, defaults to '16:9'
  video_generation_prompt?: Record<string, unknown> // JSONB field containing the prompt used for video generation
  video_duration?: string | null // Video duration in seconds (e.g., '8', '10', '15') - applicable to all video models
  video_quality?: PersistedVideoQuality | null // Video quality setting - applicable to all video models
  generation_credits_used?: number | null // Credits actually charged for generation
  is_segmented?: boolean // Whether this project uses segmented generation
  segment_count?: number // Number of segments requested (default 1)
  segment_duration_seconds?: number | null // Duration per segment (defaults to 8)
  segment_plan?: Record<string, unknown> | null // Serialized segment plan data
  segment_status?: Record<string, unknown> | null // Aggregated per-segment status payload
  merged_video_url?: string | null // Final merged video URL for segmented workflows
  fal_merge_task_id?: string | null // fal.ai merge task identifier
  merged_video_1080p_url?: string | null
  merged_video_4k_url?: string | null
  fal_merge_1080p_task_id?: string | null
  fal_merge_4k_task_id?: string | null
  retry_count?: number // Number of automatic retries for server errors (failCode: 500)
  created_at: string
  updated_at: string
}

export interface VideoCloneSelectedInputs {
  primaryAvatarId?: string | null
  primaryProductId?: string | null
  primaryPetId?: string | null
  avatarIds?: string[]
  productIds?: string[]
  petIds?: string[]
  workflowSource?: 'project_agent_clone' | 'default' | string
  mergePolicy?: 'manual_confirm' | 'auto' | string
  referenceSourceType?: 'reference_video' | 'creator_source_video' | null
  referenceSourceMediaType?: 'video' | null
  referenceSourceId?: string | null
  isCloneMode?: boolean
  supplementalText?: string | null
  executionMode?: 'clone' | 'clone_direct_reference' | 'clone_segmented_auto' | 'edit_video'
  editVideoPrompt?: string | null
  editVideoSourceUrl?: string | null
  referenceSourceVideoUrl?: string | null
  [key: string]: unknown
}

export interface VideoCloneSegment {
  id: string
  project_id: string
  segment_index: number
  status: string
  prompt?: Record<string, unknown> | null
  contains_product?: boolean
  first_frame_task_id?: string | null
  first_frame_url?: string | null
  closing_frame_task_id?: string | null
  closing_frame_url?: string | null
  video_task_id?: string | null
  video_url?: string | null
  video_1080p_task_id?: string | null
  video_1080p_url?: string | null
  video_1080p_webhook_received_at?: string | null
  video_4k_task_id?: string | null
  video_4k_url?: string | null
  video_4k_webhook_received_at?: string | null
  error_message?: string | null
  retry_count?: number // Number of automatic retries for server errors (failCode: 500)
  video_generation_approved?: boolean // Tracks whether user has approved this segment for video generation
  created_at: string
  updated_at: string
}

// Database types for avatar_ads_scenes table
export interface AvatarAdsScene {
  id: string
  project_id: string
  scene_number: number
  scene_prompt: Record<string, unknown>
  status: 'pending' | 'generating' | 'completed' | 'failed'
  kie_video_task_id?: string | null
  video_url?: string | null
  video_1080p_task_id?: string | null
  video_1080p_url?: string | null
  video_1080p_webhook_received_at?: string | null
  video_4k_task_id?: string | null
  video_4k_url?: string | null
  video_4k_webhook_received_at?: string | null
  retry_count?: number // Number of automatic retries for server errors (failCode: 500, successFlag: 3). Max 3 retries.
  last_retry_at?: string | null // Timestamp of last retry attempt for exponential backoff calculation
  error_code?: string | null // KIE API error code (e.g., '500') for debugging
  error_message?: string | null // Last error message from KIE API
  webhook_received_at?: string | null // NEW: Timestamp when video webhook was received from KIE API
  created_at: string
  updated_at: string
}

// Database types for user_avatars table
export interface UserAvatar {
  id: string
  user_id: string
  avatar_name: string
  avatar_gender?: 'male' | 'female' | null
  photo_url: string
  file_name: string
  storage_bucket?: StorageBucket | null
  storage_path?: string | null
  photo_set_json?: AvatarPhotoSet | null
  primary_photo_url?: string
  reference_photos?: AvatarPhotoEntry[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AvatarReferenceTag = 'angle_45' | 'profile_or_detail' | 'custom'

export interface AvatarPhotoEntry {
  photo_url: string
  file_name: string
  tag?: AvatarReferenceTag
}

export interface AvatarPhotoSet {
  primary: AvatarPhotoEntry
  references: AvatarPhotoEntry[]
  updated_at: string
}

export type PetPhotoView = 'front' | 'side' | 'back'

export interface UserPet {
  id: string
  user_id: string
  pet_name: string
  front_photo_url: string
  front_file_name: string
  front_storage_bucket?: StorageBucket | null
  front_storage_path?: string | null
  side_photo_url: string
  side_file_name: string
  side_storage_bucket?: StorageBucket | null
  side_storage_path?: string | null
  back_photo_url: string
  back_file_name: string
  back_storage_bucket?: StorageBucket | null
  back_storage_path?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Database types for user_products table
export interface UserProduct {
  id: string
  user_id: string
  product_name: string
  created_at: string
  updated_at: string
  isSystem?: boolean
  user_product_photos?: UserProductPhoto[]
}

// Database types for user_product_photos table
export interface UserProductPhoto {
  id: string
  product_id: string | null  // Allow null for temporary photos
  user_id: string
  photo_url: string
  file_name: string
  storage_bucket?: StorageBucket | null
  storage_path?: string | null
  photo_role: 'frontal' | 'reference'
  is_primary: boolean
  created_at: string
  updated_at: string
  // Purification tracking fields
  purification_task_id?: string | null
  purification_status?: 'idle' | 'uploading' | 'purifying' | 'completed' | 'failed'
  purification_error?: string | null
  webhook_received_at?: string | null
  original_photo_url?: string | null
}


// Creator Sources (TikTok, etc.)
export interface CreatorSourcePlatform {
  id: string
  user_id: string
  source_id: string
  platform: string
  handle: string
  profile_url?: string | null
  avatar_url?: string | null
  display_name?: string | null
  sec_uid?: string | null
  unique_id?: string | null
  stats?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface CreatorSourceVideo {
  id: string
  user_id: string
  source_id: string
  platform: string
  platform_video_id: string
  video_url: string
  video_cdn_url?: string | null
  storage_bucket?: StorageBucket | null
  storage_path?: string | null
  description?: string | null
  stats?: Record<string, unknown> | null
  duration_seconds?: number | null
  analysis_status?: string | null
  analysis_result?: Record<string, unknown> | null
  analysis_error?: string | null
  analysis_language?: string | null
  analyzed_at?: string | null
  created_at: string
  updated_at: string
}

export interface CreatorSource {
  id: string
  user_id: string
  source_name: string
  creator_source_platforms?: CreatorSourcePlatform[]
  creator_source_videos?: CreatorSourceVideo[]
  created_at: string
  updated_at: string
}

// Motion Clone projects
export interface MotionCloneProject {
  id: string
  user_id: string
  creator_source_id?: string | null
  creator_source_video_id?: string | null
  avatar_id?: string | null
  product_id?: string | null
  product_photo_id?: string | null
  reference_video_url?: string | null
  reference_video_cdn_url?: string | null
  reference_duration_seconds?: number | null
  photo_prompt?: string | null
  video_prompt?: string | null
  preview_task_id?: string | null
  preview_image_url?: string | null
  preview_webhook_received_at?: string | null
  video_task_id?: string | null
  output_video_url?: string | null
  video_webhook_received_at?: string | null
  status: 'pending' | 'generating_preview' | 'preview_ready' | 'generating_video' | 'completed' | 'failed'
  progress_percentage?: number | null
  credits_cost: number
  generation_credits_used: number
  mode: '720p' | '1080p'
  auto_generate_video: boolean
  error_message?: string | null
  downloaded?: boolean | null
  created_at: string
  updated_at: string
}

// Database types for reference_videos table
// Note: Reference videos store analysis data only.
// Source files may be retained temporarily for analysis and then discarded.
export interface ReferenceVideo {
  id: string
  user_id: string
  reference_name: string
  source_storage_bucket?: StorageBucket | null
  source_storage_path?: string | null
  created_at: string
  updated_at: string
  // Analysis fields - these contain the reusable structure from reference videos
  analysis_result?: Record<string, unknown> | null // Detailed reference video analysis
  language?: string | null // Language short code (e.g., 'en', 'zh', 'es')
  analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed'
  analysis_error?: string | null
  analyzed_at?: string | null
  video_duration_seconds?: number | null // Total runtime for analyzed reference video
}

export type Database = {
  public: {
    Tables: {
      user_credits: {
        Row: UserCredits
        Insert: Omit<UserCredits, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserCredits, 'id' | 'created_at' | 'updated_at'>>
      }
      video_clone_projects: {
        Row: SingleVideoProject
        Insert: Omit<SingleVideoProject, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SingleVideoProject, 'id' | 'created_at' | 'updated_at'>>
      }
      video_clone_segments: {
        Row: VideoCloneSegment
        Insert: Omit<VideoCloneSegment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<VideoCloneSegment, 'id' | 'created_at' | 'updated_at'>>
      }
      motion_clone_projects: {
        Row: MotionCloneProject
        Insert: Omit<MotionCloneProject, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MotionCloneProject, 'id' | 'created_at' | 'updated_at'>>
      }
      user_avatars: {
        Row: UserAvatar
        Insert: Omit<UserAvatar, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserAvatar, 'id' | 'created_at' | 'updated_at'>>
      }
      user_pets: {
        Row: UserPet
        Insert: Omit<UserPet, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserPet, 'id' | 'created_at' | 'updated_at'>>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Storage helpers
export const uploadImageToStorage = async (file: File, filename?: string, userId = 'shared') => {
  const fileName = filename || file.name
  const extension = getFileExtension(fileName, 'png')
  const draftId = crypto.randomUUID()
  const inferredRole = fileName.includes('/person/') ? 'person' : 'product'
  const filePath = buildAvatarAdsDraftUploadPath({
    userId,
    draftId,
    role: inferredRole,
    index: 0,
    fileName: `${draftId}.${extension}`
  })

  const supabase = getSupabaseAdmin()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.tempUploads)
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/png'
    })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  const ref = buildStorageRef(supabase, STORAGE_BUCKETS.tempUploads, data.path)

  return {
    bucket: ref.bucket,
    path: ref.path,
    publicUrl: ref.publicUrl,
    fullUrl: ref.publicUrl
  }
}

// Article management functions
export async function getAllArticles(): Promise<Article[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching articles:', error)
    return []
  }

  // Defensively trim whitespace from slugs to prevent routing issues
  return (data || []).map(article => ({
    ...article,
    slug: article.slug.trim()
  }))
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = getSupabase()
  // Trim whitespace from slug for defensive matching
  const cleanSlug = slug.trim()

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', cleanSlug)
    .single()

  if (error) {
    console.error('Error fetching article:', error)
    return null
  }

  return data
}

// Utility function to generate reading time estimate
export function calculateReadingTime(content: string): string {
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute))
  return `${minutes} min read`
}

// Utility function to extract excerpt from markdown content
export function extractExcerpt(content: string, maxLength: number = 160): string {
  // Remove markdown syntax and get plain text
  const plainText = content
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/>\s/g, '') // Remove blockquotes
    .replace(/\n/g, ' ') // Replace newlines with spaces
    .trim()

  if (plainText.length <= maxLength) {
    return plainText
  }

  return plainText.substring(0, maxLength).replace(/\s+\S*$/, '') + '...'
}

// User avatar management functions
export const normalizeAvatarPhotoSet = (
  photoSet: unknown,
  fallbackPhotoUrl: string,
  fallbackFileName: string
): AvatarPhotoSet => {
  const fallbackPrimary: AvatarPhotoEntry = {
    photo_url: fallbackPhotoUrl,
    file_name: fallbackFileName || 'avatar_primary'
  }

  if (!photoSet || typeof photoSet !== 'object') {
    return {
      primary: fallbackPrimary,
      references: [],
      updated_at: new Date().toISOString()
    }
  }

  const candidate = photoSet as Partial<AvatarPhotoSet> & {
    primary?: Partial<AvatarPhotoEntry>
    references?: Array<Partial<AvatarPhotoEntry>>
  }

  const primary: AvatarPhotoEntry = {
    photo_url: candidate.primary?.photo_url || fallbackPrimary.photo_url,
    file_name: candidate.primary?.file_name || fallbackPrimary.file_name
  }

  const references = Array.isArray(candidate.references)
    ? candidate.references
      .filter((item) => typeof item?.photo_url === 'string')
      .map((item) => ({
        photo_url: item.photo_url as string,
        file_name: item.file_name || 'avatar_reference',
        tag: item.tag === 'angle_45' || item.tag === 'profile_or_detail' || item.tag === 'custom'
          ? item.tag
          : 'custom'
      }))
      .slice(0, 3)
    : []

  return {
    primary,
    references,
    updated_at: typeof candidate.updated_at === 'string'
      ? candidate.updated_at
      : new Date().toISOString()
  }
}

export const createAvatarPhotoSet = (
  primaryPhotoUrl: string,
  primaryFileName: string,
  references: AvatarPhotoEntry[] = []
): AvatarPhotoSet => ({
  primary: {
    photo_url: primaryPhotoUrl,
    file_name: primaryFileName
  },
  references: references.slice(0, 3),
  updated_at: new Date().toISOString()
})

export const addAvatarReferencePhoto = (
  photoSet: AvatarPhotoSet,
  reference: AvatarPhotoEntry
): AvatarPhotoSet => ({
  ...photoSet,
  references: [...photoSet.references, reference].slice(0, 3),
  updated_at: new Date().toISOString()
})

export const deleteAvatarReferencePhotoByIndex = (
  photoSet: AvatarPhotoSet,
  referenceIndex: number
): AvatarPhotoSet => ({
  ...photoSet,
  references: photoSet.references.filter((_, index) => index !== referenceIndex),
  updated_at: new Date().toISOString()
})

export const promoteAvatarReferenceToPrimary = (
  photoSet: AvatarPhotoSet,
  referenceIndex: number
): AvatarPhotoSet => {
  const promotedReference = photoSet.references[referenceIndex]
  if (!promotedReference) {
    return photoSet
  }

  const remainingReferences = photoSet.references.filter((_, index) => index !== referenceIndex)
  return {
    primary: {
      photo_url: promotedReference.photo_url,
      file_name: promotedReference.file_name
    },
    references: [
      ...remainingReferences,
      {
        photo_url: photoSet.primary.photo_url,
        file_name: photoSet.primary.file_name,
        tag: 'custom' as AvatarReferenceTag
      }
    ].slice(0, 3),
    updated_at: new Date().toISOString()
  }
}

export const uploadAvatarPhotoToStorage = async (
  file: File,
  userId: string,
  options?: { avatarId?: string; referenceIndex?: number }
) => {
  const fileName = `${userId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const extension = getFileExtension(file.name, 'png')
  const avatarId = options?.avatarId || crypto.randomUUID()
  const filePath = buildUserAvatarImagePath({
    userId,
    avatarId,
    extension,
    referenceIndex: options?.referenceIndex
  })
  const supabase = getSupabaseAdmin()

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.userImages)
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg'
    })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  const ref = buildStorageRef(supabase, STORAGE_BUCKETS.userImages, data.path)

  return {
    fileName,
    bucket: ref.bucket,
    path: ref.path,
    publicUrl: ref.publicUrl
  }
}

export const deleteAvatarPhotoFromStorage = async (options: {
  bucket?: string | null
  path?: string | null
  photoUrl?: string | null
}) => {
  const supabase = getSupabaseAdmin()
  await removeStorageObjectWithFallback(supabase, {
    bucket: options.bucket,
    path: options.path,
    publicUrl: options.photoUrl
  })
}

export const uploadAvatarToStorage = async (file: File, userId: string, avatarName: string) => {
  console.log(`[uploadAvatarToStorage] Starting upload for user: ${userId}, file: ${file.name} (${file.size} bytes), name: ${avatarName}`);

  const supabase = getSupabaseAdmin()
  const avatarId = crypto.randomUUID()
  const uploadResult = await uploadAvatarPhotoToStorage(file, userId, { avatarId })
  const { bucket, fileName, path, publicUrl } = uploadResult

  console.log(`[uploadAvatarToStorage] Generated public URL for user ${userId}: ${publicUrl}`);

  // Save to database with avatar_name
  console.log(`[uploadAvatarToStorage] Saving to database for user ${userId}`);
  const { data: avatarRecord, error: dbError } = await supabase
    .from('user_avatars')
    .insert({
      id: avatarId,
      user_id: userId,
      avatar_name: avatarName,
      photo_url: publicUrl,
      file_name: fileName,
      storage_bucket: bucket,
      storage_path: path,
      photo_set_json: createAvatarPhotoSet(publicUrl, fileName),
      is_active: true
    })
    .select()
    .single()

  if (dbError) {
    console.error(`[uploadAvatarToStorage] Database insert error for user ${userId}:`, {
      error: dbError.message,
      code: dbError.code,
      filePath: path
    });

    // If database insert fails, cleanup the uploaded file
    console.log(`[uploadAvatarToStorage] Cleaning up uploaded file due to database error: ${path}`);
    try {
      await removeStorageObject(supabase, bucket, path)
      console.log(`[uploadAvatarToStorage] Cleanup successful for file: ${path}`);
    } catch (cleanupError) {
      console.error(`[uploadAvatarToStorage] Cleanup failed for file ${path}:`, cleanupError);
    }

    throw new Error(`Database insert failed: ${dbError.message}`);
  }

  console.log(`[uploadAvatarToStorage] Complete success for user ${userId}, record ID: ${avatarRecord?.id}`);

  return {
    path,
    publicUrl,
    fullUrl: publicUrl,
    avatarRecord
  }
}

export const getUserAvatars = async (userId: string): Promise<UserAvatar[]> => {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('user_avatars')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data || []
}

export const deleteAvatar = async (avatarId: string, userId: string): Promise<void> => {
  const supabase = getSupabaseAdmin()

  // First get the avatar record to find the file path
  const { data: avatar, error: fetchError } = await supabase
    .from('user_avatars')
    .select('*')
    .eq('id', avatarId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !avatar) {
    throw new Error('Avatar not found or unauthorized')
  }

  // Mark as inactive in database (soft delete)
  const { error: updateError } = await supabase
    .from('user_avatars')
    .update({ is_active: false })
    .eq('id', avatarId)
    .eq('user_id', userId)

  if (updateError) {
    throw updateError
  }

  // Delete from storage (hard delete)
  try {
    await deleteAvatarPhotoFromStorage({
      bucket: avatar.storage_bucket,
      path: avatar.storage_path,
      photoUrl: avatar.photo_url
    })
  } catch (storageError) {
    console.warn('[deleteAvatar] Failed to remove primary photo:', storageError)
  }

  const normalizedPhotoSet = normalizeAvatarPhotoSet(
    avatar.photo_set_json,
    avatar.photo_url,
    avatar.file_name
  )
  for (const reference of normalizedPhotoSet.references) {
    try {
      await deleteAvatarPhotoFromStorage({
        photoUrl: reference.photo_url
      })
    } catch (storageError) {
      console.warn('[deleteAvatar] Failed to remove reference photo:', storageError)
    }
  }
}

export const uploadPetPhotoToStorage = async (
  file: File,
  userId: string,
  options: { petId: string; view: PetPhotoView }
) => {
  const extension = getFileExtension(file.name, 'jpg')
  const fileName = `${options.view}_${Date.now()}.${extension}`
  const filePath = buildUserPetPhotoPath({
    userId,
    petId: options.petId,
    view: options.view,
    extension,
  })
  const supabase = getSupabaseAdmin()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.userImages)
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    })

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  const ref = buildStorageRef(supabase, STORAGE_BUCKETS.userImages, data.path)
  return {
    bucket: ref.bucket,
    path: ref.path,
    fileName,
    publicUrl: ref.publicUrl,
  }
}

export const createUserPet = async (
  userId: string,
  petName: string,
  files: Record<PetPhotoView, File>
): Promise<UserPet> => {
  // Schema verified via Supabase MCP (2026-06-10):
  // user_pets has user_id, pet_name, front/side/back photo URLs, file names, storage refs, and is_active.
  const supabase = getSupabaseAdmin()
  const petId = crypto.randomUUID()
  const uploaded: Partial<Record<PetPhotoView, Awaited<ReturnType<typeof uploadPetPhotoToStorage>>>> = {}

  try {
    for (const view of ['front', 'side', 'back'] as PetPhotoView[]) {
      uploaded[view] = await uploadPetPhotoToStorage(files[view], userId, { petId, view })
    }

    const front = uploaded.front!
    const side = uploaded.side!
    const back = uploaded.back!
    const { data, error } = await supabase
      .from('user_pets')
      .insert({
        id: petId,
        user_id: userId,
        pet_name: petName,
        front_photo_url: front.publicUrl,
        front_file_name: front.fileName,
        front_storage_bucket: front.bucket,
        front_storage_path: front.path,
        side_photo_url: side.publicUrl,
        side_file_name: side.fileName,
        side_storage_bucket: side.bucket,
        side_storage_path: side.path,
        back_photo_url: back.publicUrl,
        back_file_name: back.fileName,
        back_storage_bucket: back.bucket,
        back_storage_path: back.path,
        is_active: true,
      })
      .select('*')
      .single()

    if (error || !data) {
      throw error ?? new Error('Failed to create pet')
    }

    return data as UserPet
  } catch (error) {
    for (const item of Object.values(uploaded)) {
      if (!item) continue
      try {
        await removeStorageObject(supabase, item.bucket, item.path)
      } catch (cleanupError) {
        console.warn('[createUserPet] Failed to cleanup uploaded pet photo:', cleanupError)
      }
    }
    throw error
  }
}

export const getUserPets = async (userId: string): Promise<UserPet[]> => {
  // Schema verified via Supabase MCP (2026-06-10): user_pets has user_id, is_active, and created_at.
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('user_pets')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data || []) as UserPet[]
}

export const getUserPetById = async (petId: string, userId: string): Promise<UserPet | null> => {
  // Schema verified via Supabase MCP (2026-06-10): user_pets has id, user_id, and is_active.
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('user_pets')
    .select('*')
    .eq('id', petId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as UserPet | null) ?? null
}

export const deleteUserPet = async (petId: string, userId: string): Promise<void> => {
  const supabase = getSupabaseAdmin()
  const pet = await getUserPetById(petId, userId)
  if (!pet) {
    throw new Error('Pet not found or unauthorized')
  }

  const { error } = await supabase
    .from('user_pets')
    .update({ is_active: false })
    .eq('id', petId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }

  const refs = [
    { bucket: pet.front_storage_bucket, path: pet.front_storage_path, photoUrl: pet.front_photo_url },
    { bucket: pet.side_storage_bucket, path: pet.side_storage_path, photoUrl: pet.side_photo_url },
    { bucket: pet.back_storage_bucket, path: pet.back_storage_path, photoUrl: pet.back_photo_url },
  ]
  for (const ref of refs) {
    try {
      await removeStorageObjectWithFallback(supabase, {
        bucket: ref.bucket,
        path: ref.path,
        publicUrl: ref.photoUrl,
      })
    } catch (storageError) {
      console.warn('[deleteUserPet] Failed to remove pet photo:', storageError)
    }
  }
}

export const updatePetName = async (
  petId: string,
  userId: string,
  newName: string
): Promise<UserPet> => {
  // Schema verified via Supabase MCP (2026-06-24): user_pets has pet_name and is_active.
  const pet = await getUserPetById(petId, userId)
  if (!pet) {
    throw new Error('Pet not found or unauthorized')
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('user_pets')
    .update({ pet_name: newName })
    .eq('id', petId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('*')
    .single()

  if (error || !data) {
    throw error ?? new Error('Failed to update pet name')
  }

  return data as UserPet
}

export const replacePetPhoto = async (
  petId: string,
  userId: string,
  view: PetPhotoView,
  file: File
): Promise<UserPet> => {
  // Schema verified via Supabase MCP (2026-06-24):
  // user_pets has front/side/back URL, file, bucket, path columns plus is_active.
  const pet = await getUserPetById(petId, userId)
  if (!pet) {
    throw new Error('Pet not found or unauthorized')
  }

  const supabase = getSupabaseAdmin()
  const uploaded = await uploadPetPhotoToStorage(file, userId, { petId, view })

  const viewColumns: Record<PetPhotoView, Record<string, string>> = {
    front: {
      photo_url: 'front_photo_url',
      file_name: 'front_file_name',
      storage_bucket: 'front_storage_bucket',
      storage_path: 'front_storage_path'
    },
    side: {
      photo_url: 'side_photo_url',
      file_name: 'side_file_name',
      storage_bucket: 'side_storage_bucket',
      storage_path: 'side_storage_path'
    },
    back: {
      photo_url: 'back_photo_url',
      file_name: 'back_file_name',
      storage_bucket: 'back_storage_bucket',
      storage_path: 'back_storage_path'
    }
  }

  const cols = viewColumns[view]
  const oldBucket = pet[`${view}_storage_bucket` as keyof UserPet] as string | null | undefined
  const oldPath = pet[`${view}_storage_path` as keyof UserPet] as string | null | undefined
  const oldUrl = pet[`${view}_photo_url` as keyof UserPet] as string

  const { data, error } = await supabase
    .from('user_pets')
    .update({
      [cols.photo_url]: uploaded.publicUrl,
      [cols.file_name]: uploaded.fileName,
      [cols.storage_bucket]: uploaded.bucket,
      [cols.storage_path]: uploaded.path
    })
    .eq('id', petId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .select('*')
    .single()

  if (error || !data) {
    try {
      await removeStorageObject(supabase, uploaded.bucket, uploaded.path)
    } catch (cleanupError) {
      console.warn('[replacePetPhoto] Failed to cleanup new upload:', cleanupError)
    }
    throw error ?? new Error('Failed to replace pet photo')
  }

  try {
    await removeStorageObjectWithFallback(supabase, {
      bucket: oldBucket || undefined,
      path: oldPath || undefined,
      publicUrl: oldUrl
    })
  } catch (storageError) {
    console.warn('[replacePetPhoto] Failed to remove old pet photo:', storageError)
  }

  return data as UserPet
}


export const uploadAvatarFromUrl = async (imageUrl: string, userId: string, avatarName: string = 'Optimized Avatar') => {
  console.log(`[uploadAvatarFromUrl] Starting upload for user: ${userId}, url: ${imageUrl}`);

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/png';
    // Handle content-type like "image/jpeg; charset=utf-8"
    const mimeType = contentType.split(';')[0].trim();
    const ext = mimeType.split('/')[1] || 'png';

    const supabase = getSupabaseAdmin();
    const avatarId = crypto.randomUUID();
    const fileName = `${userId}_${Date.now()}_optimized.${ext}`;
    const filePath = buildUserAvatarImagePath({
      userId,
      avatarId,
      extension: ext
    });

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.userImages)
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const ref = buildStorageRef(supabase, STORAGE_BUCKETS.userImages, data.path);

    const { data: avatarRecord, error: dbError } = await supabase
      .from('user_avatars')
      .insert({
        id: avatarId,
        user_id: userId,
        avatar_name: avatarName,
        photo_url: ref.publicUrl,
        file_name: fileName,
        storage_bucket: ref.bucket,
        storage_path: ref.path,
        photo_set_json: createAvatarPhotoSet(ref.publicUrl, fileName),
        is_active: true
      })
      .select()
      .single();

    if (dbError) {
       await removeStorageObject(supabase, ref.bucket, ref.path);
       throw dbError;
    }

    return {
      bucket: ref.bucket,
      path: ref.path,
      publicUrl: ref.publicUrl,
      fullUrl: ref.publicUrl,
      avatarRecord
    };

  } catch (error) {
    console.error('[uploadAvatarFromUrl] Error:', error);
    throw error;
  }
}

export const updateAvatarName = async (
  avatarId: string,
  userId: string,
  newName: string
): Promise<UserAvatar> => {
  const supabase = getSupabaseAdmin()

  // Update avatar_name in database, verify user_id matches for security
  const { data, error } = await supabase
    .from('user_avatars')
    .update({ avatar_name: newName })
    .eq('id', avatarId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error(`[updateAvatarName] Error updating avatar ${avatarId}:`, error);
    throw new Error(`Failed to update avatar name: ${error.message}`);
  }

  if (!data) {
    throw new Error('Avatar not found or unauthorized');
  }

  console.log(`[updateAvatarName] Successfully updated avatar ${avatarId} to name: ${newName}`);
  return data;
}

// Upload product photo to storage in the correct product folder
export const uploadProductPhotoToStorage = async (
  file: File,
  userId: string,
  options?: {
    productId?: string
    photoId?: string
    draftId?: string
    variant?: 'original' | 'purified'
    bucket?: StorageBucket
  }
) => {
  console.log(`[uploadProductPhotoToStorage] Starting upload for user: ${userId}, file: ${file.name} (${file.size} bytes)`);
  const extension = getFileExtension(file.name, 'jpg')
  const bucket = options?.bucket || STORAGE_BUCKETS.userImages
  const photoId = options?.photoId || crypto.randomUUID()
  const filePath = bucket === STORAGE_BUCKETS.tempUploads
    ? buildTempProductPhotoPath({
      userId,
      draftId: options?.draftId || photoId,
      fileName: file.name
    })
    : buildUserProductPhotoPath({
      userId,
      productId: options?.productId || 'temporary',
      photoId,
      extension,
      variant: options?.variant || 'original'
    })
  const supabase = getSupabaseAdmin()

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload to storage
  console.log(`[uploadProductPhotoToStorage] Uploading to storage path: ${filePath}`);
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg'
    })

  if (error) {
    console.error(`[uploadProductPhotoToStorage] Storage upload error for user ${userId}:`, {
      error: error.message,
      filePath,
      fileName: file.name
    });
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  console.log(`[uploadProductPhotoToStorage] Storage upload successful for user ${userId}, path: ${data.path}`);

  const ref = buildStorageRef(supabase, bucket, data.path)

  console.log(`[uploadProductPhotoToStorage] Generated public URL for user ${userId}: ${ref.publicUrl}`);

  return {
    bucket: ref.bucket,
    path: ref.path,
    photoId,
    publicUrl: ref.publicUrl,
    fullUrl: ref.publicUrl
  }
}

export const deleteProductPhotoFromStorage = async (options: {
  bucket?: string | null
  path?: string | null
  photoUrl?: string | null | undefined
}) => {
  const supabase = getSupabaseAdmin()
  console.log('[deleteProductPhotoFromStorage] Deleting file from storage', options)
  await removeStorageObjectWithFallback(supabase, {
    bucket: options.bucket,
    path: options.path,
    publicUrl: options.photoUrl
  })
}

// NOTE: Reference video storage functions have been removed
// Reference videos now store analysis data, not original video files
// Files are temporarily uploaded for analysis, then discarded immediately
