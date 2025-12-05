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
  indexed_at?: string // Timestamp when article was submitted to Google (NOT when actually indexed)
  indexing_status?: 'pending' | 'submitted' | 'failed' | 'verified_indexed' | 'verified_not_indexed' // Current indexing status
  indexing_error?: string // Error message if submission failed
  indexing_attempts?: number // Number of submission attempts (max 3 retries)
  indexing_verified_at?: string // Timestamp when indexing was verified via URL Inspection API
  actual_indexing_state?: string // Actual indexing state from Google Search Console (coverageState)
}

// Database types for single_video_projects table (now standard_ads_projects)
export interface SingleVideoProject {
  id: string
  user_id: string
  cover_image_url?: string
  video_url?: string
  video_prompts?: Record<string, unknown>
  image_prompt?: Record<string, unknown> // JSONB field containing the prompt used for cover generation
  video_model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok'
  credits_cost: number
  status: 'processing' | 'completed' | 'failed' | 'upload_complete' | 'description_complete' | 'prompts_complete' | 'cover_complete'
  error_message?: string
  language?: string | null // Preferred language code for prompts and narration
  watermark_text?: string | null
  watermark_location?: string | null
  cover_image_aspect_ratio?: string | null // Aspect ratio of the cover image (e.g., "16:9", "9:16", "1:1")
  photo_only?: boolean // If true, workflow skips video generation and only produces a cover image
  downloaded?: boolean // Whether user has downloaded the video
  download_credits_used?: number // DEPRECATED: Credits used for downloading (no longer applicable, downloads are free)
  cover_task_id?: string | null
  video_task_id?: string | null
  current_step?: 'describing' | 'generating_prompts' | 'generating_cover' | 'generating_video' | 'completed'
  progress_percentage?: number
  last_processed_at?: string
  selected_product_id?: string | null // Reference to user_products table
  selected_brand_id?: string | null // Reference to user_brands table
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

export interface StandardAdsSegment {
  id: string
  project_id: string
  segment_index: number
  status: string
  prompt?: Record<string, unknown> | null
  first_frame_task_id?: string | null
  first_frame_url?: string | null
  closing_frame_task_id?: string | null
  closing_frame_url?: string | null
  video_task_id?: string | null
  video_url?: string | null
  error_message?: string | null
  retry_count?: number // Number of automatic retries for server errors (failCode: 500)
  created_at: string
  updated_at: string
}

// Database types for user_photos table
export interface UserPhoto {
  id: string
  user_id: string
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
export interface CompetitorAd {
  id: string
  user_id: string
  brand_id: string
  competitor_name: string
  platform: string // 'Facebook', 'Instagram', 'TikTok', 'YouTube', etc.
  ad_file_url: string
  file_type: 'image' | 'video'
  created_at: string
  updated_at: string
  brand?: UserBrand // Joined data when fetching with brand relationship
  // Analysis fields (added in migration 20251117000000)
  analysis_result?: Record<string, unknown> | null // 10 Veo elements analysis
  language?: string | null // Language short code (e.g., 'en', 'zh', 'es')
  analysis_status?: 'pending' | 'analyzing' | 'completed' | 'failed'
  analysis_error?: string | null
  analyzed_at?: string | null
  video_duration_seconds?: number | null // Total runtime for analyzed competitor video
}

// Database types for sora2_watermark_removal_tasks table
export interface Sora2WatermarkRemovalTask {
  id: string
  user_id: string
  input_video_url: string
  output_video_url?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  kie_task_id?: string
  credits_used: number
  error_message?: string
  created_at: string
  completed_at?: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      user_credits: {
        Row: UserCredits
        Insert: Omit<UserCredits, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserCredits, 'id' | 'created_at' | 'updated_at'>>
      }
      standard_ads_projects: {
        Row: SingleVideoProject
        Insert: Omit<SingleVideoProject, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<SingleVideoProject, 'id' | 'created_at' | 'updated_at'>>
      }
      standard_ads_segments: {
        Row: StandardAdsSegment
        Insert: Omit<StandardAdsSegment, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<StandardAdsSegment, 'id' | 'created_at' | 'updated_at'>>
      }
      user_photos: {
        Row: UserPhoto
        Insert: Omit<UserPhoto, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserPhoto, 'id' | 'created_at' | 'updated_at'>>
      }
      sora2_watermark_removal_tasks: {
        Row: Sora2WatermarkRemovalTask
        Insert: Omit<Sora2WatermarkRemovalTask, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Sora2WatermarkRemovalTask, 'id' | 'created_at' | 'updated_at'>>
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

// User photo management functions
export const uploadUserPhotoToStorage = async (file: File, userId: string) => {
  console.log(`[uploadUserPhotoToStorage] Starting upload for user: ${userId}, file: ${file.name} (${file.size} bytes)`);

  const fileName = `${userId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const filePath = `user-photos/${fileName}`

  const supabase = getSupabase()

  // Upload to storage
  console.log(`[uploadUserPhotoToStorage] Uploading to storage path: ${filePath}`);
  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    console.error(`[uploadUserPhotoToStorage] Storage upload error for user ${userId}:`, {
      error: error.message,
      filePath,
      fileSize: file.size,
      fileType: file.type
    });
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  console.log(`[uploadUserPhotoToStorage] Storage upload successful for user ${userId}, path: ${data.path}`);

  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(filePath)

  console.log(`[uploadUserPhotoToStorage] Generated public URL for user ${userId}: ${publicUrl}`);

  // Save to database
  console.log(`[uploadUserPhotoToStorage] Saving to database for user ${userId}`);
  const { data: photoRecord, error: dbError } = await supabase
    .from('user_photos')
    .insert({
      user_id: userId,
      photo_url: publicUrl,
      file_name: fileName,
      is_active: true
    })
    .select()
    .single()

  if (dbError) {
    console.error(`[uploadUserPhotoToStorage] Database insert error for user ${userId}:`, {
      error: dbError.message,
      code: dbError.code,
      filePath
    });

    // If database insert fails, cleanup the uploaded file
    console.log(`[uploadUserPhotoToStorage] Cleaning up uploaded file due to database error: ${filePath}`);
    try {
      await supabase.storage.from('images').remove([filePath])
      console.log(`[uploadUserPhotoToStorage] Cleanup successful for file: ${filePath}`);
    } catch (cleanupError) {
      console.error(`[uploadUserPhotoToStorage] Cleanup failed for file ${filePath}:`, cleanupError);
    }

    throw new Error(`Database insert failed: ${dbError.message}`);
  }

  console.log(`[uploadUserPhotoToStorage] Complete success for user ${userId}, record ID: ${photoRecord?.id}`);

  return {
    path: data.path,
    publicUrl,
    fullUrl: publicUrl,
    photoRecord
  }
}

export const getUserPhotos = async (userId: string): Promise<UserPhoto[]> => {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('user_photos')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return data || []
}

export const deleteUserPhoto = async (photoId: string, userId: string): Promise<void> => {
  const supabase = getSupabase()

  // First get the photo record to find the file path
  const { data: photo, error: fetchError } = await supabase
    .from('user_photos')
    .select('*')
    .eq('id', photoId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !photo) {
    throw new Error('Photo not found or unauthorized')
  }

  // Mark as inactive in database (soft delete)
  const { error: updateError } = await supabase
    .from('user_photos')
    .update({ is_active: false })
    .eq('id', photoId)
    .eq('user_id', userId)

  if (updateError) {
    throw updateError
  }

  // Delete from storage (hard delete)
  const filePath = `user-photos/${photo.file_name}`
  const { error: storageError } = await supabase.storage.from('images').remove([filePath])

  // Optionally delete from storage (uncomment if you want hard delete)
  // const filePath = `user-photos/${photo.file_name}`
  // await supabase.storage.from('images').remove([filePath])
}

export const uploadUserPhotoFromUrl = async (imageUrl: string, userId: string) => {
  console.log(`[uploadUserPhotoFromUrl] Starting upload for user: ${userId}, url: ${imageUrl}`);

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
    const filePath = `user-photos/${fileName}`;
    
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

    const { data: photoRecord, error: dbError } = await supabase
      .from('user_photos')
      .insert({
        user_id: userId,
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
      photoRecord
    };

  } catch (error) {
    console.error('[uploadUserPhotoFromUrl] Error:', error);
    throw error;
  }
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

// Upload competitor ad file (image or video) to storage
export const uploadCompetitorAdToStorage = async (
  file: File,
  brandId: string,
  competitorName: string
) => {
  console.log(`[uploadCompetitorAdToStorage] Starting upload for brand: ${brandId}, competitor: ${competitorName}, file: ${file.name} (${file.size} bytes)`);

  // Validate file type
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (!isImage && !isVideo) {
    throw new Error('File must be an image or video');
  }

  // Validate file size (max 100MB for videos, 10MB for images)
  const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File size must be less than ${isVideo ? '100MB' : '10MB'}`);
  }

  const fileExt = file.name.split('.').pop();
  const timestamp = Date.now();
  const fileName = `${timestamp}_${competitorName.toLowerCase().replace(/\s+/g, '_')}.${fileExt}`;
  const filePath = `${brandId}/${competitorName}/${fileName}`;

  const supabase = getSupabaseAdmin();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to competitor_videos bucket
  console.log(`[uploadCompetitorAdToStorage] Uploading to storage path: ${filePath}`);
  const { data, error } = await supabase.storage
    .from('competitor_videos')
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });

  if (error) {
    console.error(`[uploadCompetitorAdToStorage] Storage upload error:`, {
      error: error.message,
      filePath,
      fileName: file.name
    });
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  console.log(`[uploadCompetitorAdToStorage] Storage upload successful, path: ${data.path}`);

  const { data: { publicUrl } } = supabase.storage
    .from('competitor_videos')
    .getPublicUrl(filePath);

  console.log(`[uploadCompetitorAdToStorage] Generated public URL: ${publicUrl}`);

  return {
    path: data.path,
    publicUrl,
    fullUrl: publicUrl,
    fileType: isVideo ? 'video' : 'image'
  };
};

// Delete competitor ad file from storage
export const deleteCompetitorAdFromStorage = async (adFileUrl: string | null | undefined): Promise<void> => {
  if (!adFileUrl) return
  const supabase = getSupabaseAdmin();

  // Extract file path from URL
  // Format: https://{project}.supabase.co/storage/v1/object/public/competitor_videos/{brand_id}/{competitor_name}/{filename}
  const urlParts = adFileUrl.split('/competitor_videos/');
  if (urlParts.length < 2) {
    console.error(`[deleteCompetitorAdFromStorage] Invalid ad file URL format: ${adFileUrl}`);
    return;
  }

  const filePath = urlParts[1];
  console.log(`[deleteCompetitorAdFromStorage] Deleting file at path: ${filePath}`);

  const { error } = await supabase.storage
    .from('competitor_videos')
    .remove([filePath]);

  if (error) {
    console.error(`[deleteCompetitorAdFromStorage] Error deleting file:`, error);
    throw new Error(`Failed to delete competitor ad file: ${error.message}`);
  }

  console.log(`[deleteCompetitorAdFromStorage] Successfully deleted file: ${filePath}`);
};

// Google Indexing API helpers

/**
 * Get unindexed articles (pending or failed with < 3 attempts)
 */
export async function getUnindexedArticles(): Promise<Article[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .or('indexing_status.eq.pending,and(indexing_status.eq.failed,indexing_attempts.lt.3)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getUnindexedArticles] Error fetching unindexed articles:', error)
    throw error
  }

  return (data || []).map(article => ({
    ...article,
    slug: article.slug.trim()
  }))
}

/**
 * Update article indexing status after submission
 */
export async function updateArticleIndexingStatus(
  articleId: string,
  status: 'pending' | 'submitted' | 'failed' | 'verified_indexed' | 'verified_not_indexed',
  error?: string
): Promise<void> {
  const supabase = getSupabaseAdmin() // Use admin client to bypass RLS

  const updateData: {
    indexing_status: 'pending' | 'submitted' | 'failed' | 'verified_indexed' | 'verified_not_indexed';
    indexing_error: string | null;
    indexed_at?: string;
    indexing_attempts?: number;
  } = {
    indexing_status: status,
    indexing_error: error || null,
  }

  if (status === 'submitted') {
    updateData.indexed_at = new Date().toISOString()
    updateData.indexing_attempts = 0 // Reset attempts on successful submission
  } else if (status === 'failed') {
    // Increment attempts only on failure
    const { data: article } = await supabase
      .from('articles')
      .select('indexing_attempts')
      .eq('id', articleId)
      .single()

    updateData.indexing_attempts = (article?.indexing_attempts || 0) + 1
  }

  const { error: updateError } = await supabase
    .from('articles')
    .update(updateData)
    .eq('id', articleId)

  if (updateError) {
    console.error('[updateArticleIndexingStatus] Error updating article:', updateError)
    throw updateError
  }

  console.log(`[updateArticleIndexingStatus] Updated article ${articleId} to status: ${status}`)
}

/**
 * Batch update multiple article indexing statuses
 */
export async function batchUpdateArticleIndexingStatus(
  updates: Array<{ articleId: string; status: 'submitted' | 'failed'; error?: string }>
): Promise<void> {
  // Process updates sequentially to ensure proper attempt counting
  for (const update of updates) {
    await updateArticleIndexingStatus(update.articleId, update.status, update.error)
  }

  console.log(`[batchUpdateArticleIndexingStatus] Updated ${updates.length} articles`)
}

/**
 * Reset indexing status for an article (useful for manual retry)
 */
export async function resetArticleIndexingStatus(articleId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('articles')
    .update({
      indexing_status: 'pending',
      indexing_attempts: 0,
      indexing_error: null,
    })
    .eq('id', articleId)

  if (error) {
    console.error('[resetArticleIndexingStatus] Error resetting article:', error)
    throw error
  }

  console.log(`[resetArticleIndexingStatus] Reset indexing status for article ${articleId}`)
}

// URL Inspection API (verification) helpers

/**
 * Get articles that need indexing verification
 * Query articles that were submitted 3+ days ago but haven't been verified yet
 *
 * @param daysAgo - Number of days since submission (default: 3)
 * @param limit - Maximum number of articles to return (default: 100)
 */
export async function getArticlesNeedingVerification(
  daysAgo: number = 3,
  limit: number = 100
): Promise<Article[]> {
  const supabase = getSupabase()

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo)

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('indexing_status', 'submitted')
    .is('indexing_verified_at', null)
    .lte('indexed_at', cutoffDate.toISOString())
    .order('indexed_at', { ascending: true }) // Oldest first
    .limit(limit)

  if (error) {
    console.error('[getArticlesNeedingVerification] Error fetching articles:', error)
    throw error
  }

  return (data || []).map(article => ({
    ...article,
    slug: article.slug.trim()
  }))
}

/**
 * Update article verification status after checking with URL Inspection API
 */
export async function updateArticleVerificationStatus(
  articleId: string,
  isIndexed: boolean,
  actualIndexingState?: string,
  error?: string
): Promise<void> {
  const supabase = getSupabaseAdmin() // Use admin client to bypass RLS

  const updateData: {
    indexing_status: 'verified_indexed' | 'verified_not_indexed';
    indexing_verified_at: string;
    actual_indexing_state: string | null;
    indexing_error?: string | null;
  } = {
    indexing_status: isIndexed ? 'verified_indexed' : 'verified_not_indexed',
    indexing_verified_at: new Date().toISOString(),
    actual_indexing_state: actualIndexingState || null,
  }

  if (error) {
    updateData.indexing_error = error
  }

  const { error: updateError } = await supabase
    .from('articles')
    .update(updateData)
    .eq('id', articleId)

  if (updateError) {
    console.error('[updateArticleVerificationStatus] Error updating article:', updateError)
    throw updateError
  }

  console.log(
    `[updateArticleVerificationStatus] Updated article ${articleId} verification: ${
      isIndexed ? 'INDEXED' : 'NOT INDEXED'
    }`
  )
}
