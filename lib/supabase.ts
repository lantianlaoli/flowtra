import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Buffer } from 'buffer'

// Lazily initialize clients to avoid evaluating env vars during build time
let browserClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public URL or anon key is not configured')
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey)
  return browserClient
}

// Service role client for bypassing RLS (server-only)
export function getSupabaseAdmin(): SupabaseClient {
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
  return serviceClient
}

// Database types for user_credits table
export interface UserCredits {
  id: string
  user_id: string
  credits_remaining: number
  subscription_credits: number
  purchased_credits: number
  has_purchased: boolean
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

// Database types for single_video_projects table (now competitor_ugc_replication_projects)
export interface SingleVideoProject {
  id: string
  user_id: string
  video_url?: string
  video_prompts?: Record<string, unknown>
  image_prompt?: Record<string, unknown> // JSONB field containing the prompt used for cover generation
  video_model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling_2_6'
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
  selected_brand_id?: string | null // Reference to user_brands table
  video_generation_requested?: boolean | null // Whether user approved moving from cover to video
  video_aspect_ratio?: string // Video aspect ratio, defaults to '16:9'
  video_generation_prompt?: Record<string, unknown> // JSONB field containing the prompt used for video generation
  video_duration?: string | null // Video duration in seconds (e.g., '8', '10', '15') - applicable to all video models
  video_quality?: 'standard' | 'high' | null // Video quality setting - applicable to all video models
  is_segmented?: boolean // Whether this project uses segmented generation
  segment_count?: number // Number of segments requested (default 1)
  segment_duration_seconds?: number | null // Duration per segment (defaults to 8)
  segment_plan?: Record<string, unknown> | null // Serialized segment plan data
  segment_status?: Record<string, unknown> | null // Aggregated per-segment status payload
  merged_video_url?: string | null // Final merged video URL for segmented workflows
  fal_merge_task_id?: string | null // fal.ai merge task identifier
  retry_count?: number // Number of automatic retries for server errors (failCode: 500)
  created_at: string
  updated_at: string
}

export interface CompetitorUgcReplicationSegment {
  id: string
  project_id: string
  segment_index: number
  status: string
  prompt?: Record<string, unknown> | null
  contains_brand?: boolean
  contains_product?: boolean
  first_frame_task_id?: string | null
  first_frame_url?: string | null
  closing_frame_task_id?: string | null
  closing_frame_url?: string | null
  video_task_id?: string | null
  video_url?: string | null
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
  photo_url: string
  file_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Database types for user_brands table
export interface UserBrand {
  id: string
  user_id: string
  brand_name: string
  brand_logo_url?: string | null
  brand_slogan?: string
  brand_details?: string | null
  created_at: string
  updated_at: string
}

// Database types for user_products table
export interface UserProduct {
  id: string
  user_id: string
  product_name: string
  description?: string
  product_details?: string | null
  brand_id?: string
  created_at: string
  updated_at: string
  user_product_photos?: UserProductPhoto[]
  brand?: UserBrand // Joined data when fetching with brand relationship
}

// Database types for user_product_photos table
export interface UserProductPhoto {
  id: string
  product_id: string
  user_id: string
  photo_url: string
  file_name: string
  is_primary: boolean
  created_at: string
  updated_at: string
}

// Database types for competitor_ads table
// Note: Competitor ads now store only analysis data (no video files or platform info)
// Files are temporarily uploaded for analysis, then discarded
export interface CompetitorAd {
  id: string
  user_id: string
  brand_id: string
  competitor_name: string
  created_at: string
  updated_at: string
  brand?: UserBrand // Joined data when fetching with brand relationship
  // Analysis fields - these contain all valuable data from competitor ads
  analysis_result?: Record<string, unknown> | null // 10 Veo elements analysis (complete shot breakdown)
  language?: string | null // Language short code (e.g., 'en', 'zh', 'es')
  analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed'
  analysis_error?: string | null
  analyzed_at?: string | null
  video_duration_seconds?: number | null // Total runtime for analyzed competitor video
}

export type Database = {
  public: {
    Tables: {
      user_credits: {
        Row: UserCredits
        Insert: Omit<UserCredits, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserCredits, 'id' | 'created_at' | 'updated_at'>>
      }
      competitor_ugc_replication_projects: {
        Row: SingleVideoProject
        Insert: Omit<SingleVideoProject, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SingleVideoProject, 'id' | 'created_at' | 'updated_at'>>
      }
      competitor_ugc_replication_segments: {
        Row: CompetitorUgcReplicationSegment
        Insert: Omit<CompetitorUgcReplicationSegment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CompetitorUgcReplicationSegment, 'id' | 'created_at' | 'updated_at'>>
      }
      user_avatars: {
        Row: UserAvatar
        Insert: Omit<UserAvatar, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserAvatar, 'id' | 'created_at' | 'updated_at'>>
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
export const uploadImageToStorage = async (file: File, filename?: string) => {
  const fileExt = file.name.split('.').pop()
  const fileName = filename || `${Math.random().toString(36).substring(2)}.${fileExt}`
  const filePath = `temporary_products/${fileName}`

  const supabase = getSupabase()
  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    throw error
  }

  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(filePath)

  return {
    path: data.path,
    publicUrl,
    fullUrl: publicUrl
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
export const uploadAvatarToStorage = async (file: File, userId: string, avatarName: string) => {
  console.log(`[uploadAvatarToStorage] Starting upload for user: ${userId}, file: ${file.name} (${file.size} bytes), name: ${avatarName}`);

  const fileName = `${userId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const filePath = `avatars/${fileName}`

  const supabase = getSupabase()

  // Upload to storage
  console.log(`[uploadAvatarToStorage] Uploading to storage path: ${filePath}`);
  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    console.error(`[uploadAvatarToStorage] Storage upload error for user ${userId}:`, {
      error: error.message,
      filePath,
      fileSize: file.size,
      fileType: file.type
    });
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  console.log(`[uploadAvatarToStorage] Storage upload successful for user ${userId}, path: ${data.path}`);

  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(filePath)

  console.log(`[uploadAvatarToStorage] Generated public URL for user ${userId}: ${publicUrl}`);

  // Save to database with avatar_name
  console.log(`[uploadAvatarToStorage] Saving to database for user ${userId}`);
  const { data: avatarRecord, error: dbError } = await supabase
    .from('user_avatars')
    .insert({
      user_id: userId,
      avatar_name: avatarName,
      photo_url: publicUrl,
      file_name: fileName,
      is_active: true
    })
    .select()
    .single()

  if (dbError) {
    console.error(`[uploadAvatarToStorage] Database insert error for user ${userId}:`, {
      error: dbError.message,
      code: dbError.code,
      filePath
    });

    // If database insert fails, cleanup the uploaded file
    console.log(`[uploadAvatarToStorage] Cleaning up uploaded file due to database error: ${filePath}`);
    try {
      await supabase.storage.from('images').remove([filePath])
      console.log(`[uploadAvatarToStorage] Cleanup successful for file: ${filePath}`);
    } catch (cleanupError) {
      console.error(`[uploadAvatarToStorage] Cleanup failed for file ${filePath}:`, cleanupError);
    }

    throw new Error(`Database insert failed: ${dbError.message}`);
  }

  console.log(`[uploadAvatarToStorage] Complete success for user ${userId}, record ID: ${avatarRecord?.id}`);

  return {
    path: data.path,
    publicUrl,
    fullUrl: publicUrl,
    avatarRecord
  }
}

export const getUserAvatars = async (userId: string): Promise<UserAvatar[]> => {
  const supabase = getSupabase()
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
  const supabase = getSupabase()

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
  const filePath = `avatars/${avatar.file_name}`
  const { error: storageError } = await supabase.storage.from('images').remove([filePath])

  // Optionally delete from storage (uncomment if you want hard delete)
  // const filePath = `avatars/${avatar.file_name}`
  // await supabase.storage.from('images').remove([filePath])
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

    const fileName = `${userId}_${Date.now()}_optimized.${ext}`;
    const filePath = `avatars/${fileName}`;

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, buffer, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    const { data: avatarRecord, error: dbError } = await supabase
      .from('user_avatars')
      .insert({
        user_id: userId,
        avatar_name: avatarName,
        photo_url: publicUrl,
        file_name: fileName,
        is_active: true
      })
      .select()
      .single();

    if (dbError) {
       await supabase.storage.from('images').remove([filePath]);
       throw dbError;
    }

    return {
      path: data.path,
      publicUrl,
      fullUrl: publicUrl,
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
  const supabase = getSupabase()

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
export const uploadProductPhotoToStorage = async (file: File, userId: string) => {
  console.log(`[uploadProductPhotoToStorage] Starting upload for user: ${userId}, file: ${file.name} (${file.size} bytes)`);
  const fileName = `${userId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const filePath = `product/${fileName}`
  const supabase = getSupabaseAdmin()

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload to storage
  console.log(`[uploadProductPhotoToStorage] Uploading to storage path: ${filePath}`);
  const { data, error } = await supabase.storage
    .from('images')
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

  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(filePath)

  console.log(`[uploadProductPhotoToStorage] Generated public URL for user ${userId}: ${publicUrl}`);

  return {
    path: data.path,
    publicUrl,
    fullUrl: publicUrl
  }
}

export const deleteProductPhotoFromStorage = async (photoUrl: string | null | undefined) => {
  if (!photoUrl) return

  const supabase = getSupabaseAdmin()
  const urlParts = photoUrl.split('/images/')
  if (urlParts.length < 2) {
    console.warn(`[deleteProductPhotoFromStorage] Invalid photo URL format: ${photoUrl}`)
    return
  }

  const filePath = urlParts[1]
  console.log(`[deleteProductPhotoFromStorage] Deleting file at path: ${filePath}`)

  const { error } = await supabase.storage
    .from('images')
    .remove([filePath])

  if (error) {
    console.error(`[deleteProductPhotoFromStorage] Error deleting file:`, error)
    throw new Error(`Failed to delete product photo: ${error.message}`)
  }

  console.log(`[deleteProductPhotoFromStorage] Successfully deleted file: ${filePath}`)
}

// Upload brand logo to storage in brands folder
export const uploadBrandLogoToStorage = async (file: File, userId: string) => {
  console.log(`[uploadBrandLogoToStorage] Starting upload for user: ${userId}, file: ${file.name} (${file.size} bytes)`);

  const fileExt = file.name.split('.').pop()
  const uuid = Math.random().toString(36).substring(2, 15)
  const fileName = `${uuid}_logo.${fileExt}`
  const filePath = `brands/${userId}/${fileName}`

  const supabase = getSupabaseAdmin()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload to storage
  console.log(`[uploadBrandLogoToStorage] Uploading to storage path: ${filePath}`);
  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/png'
    })

  if (error) {
    console.error(`[uploadBrandLogoToStorage] Storage upload error for user ${userId}:`, {
      error: error.message,
      filePath,
      fileName: file.name
    });
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  console.log(`[uploadBrandLogoToStorage] Storage upload successful for user ${userId}, path: ${data.path}`);

  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(filePath)

  console.log(`[uploadBrandLogoToStorage] Generated public URL for user ${userId}: ${publicUrl}`);

  return {
    path: data.path,
    publicUrl,
    fullUrl: publicUrl
  }
}

// Delete brand logo from storage
export const deleteBrandLogoFromStorage = async (logoUrl: string | null | undefined): Promise<void> => {
  if (!logoUrl) return

  const supabase = getSupabaseAdmin()

  // Extract file path from URL
  // Format: https://{project}.supabase.co/storage/v1/object/public/images/brands/{userId}/{filename}
  const urlParts = logoUrl.split('/images/')
  if (urlParts.length < 2) {
    console.error(`[deleteBrandLogoFromStorage] Invalid logo URL format: ${logoUrl}`);
    return
  }

  const filePath = urlParts[1]
  console.log(`[deleteBrandLogoFromStorage] Deleting file at path: ${filePath}`);

  const { error } = await supabase.storage
    .from('images')
    .remove([filePath])

  if (error) {
    console.error(`[deleteBrandLogoFromStorage] Error deleting file:`, error);
    throw new Error(`Failed to delete brand logo: ${error.message}`);
  }

  console.log(`[deleteBrandLogoFromStorage] Successfully deleted file: ${filePath}`);
}

// NOTE: Competitor ad storage functions have been removed
// Competitor ads now only store analysis data, not video files
// Files are temporarily uploaded for analysis, then discarded immediately

