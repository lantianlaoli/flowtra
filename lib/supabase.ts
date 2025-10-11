import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazily initialize clients to avoid evaluating env vars during build time
let browserClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

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
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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
}

// Database types for single_video_projects table (now standard_ads_projects)
export interface SingleVideoProject {
  id: string
  user_id: string
  original_image_url: string
  cover_image_url?: string
  video_url?: string
  product_description?: Record<string, unknown> // JSONB field containing { description: string }
  video_prompts?: Record<string, unknown>
  image_prompt?: Record<string, unknown> // JSONB field containing the prompt used for cover generation
  video_model: 'veo3' | 'veo3_fast' | 'sora2'
  credits_cost: number
  status: 'processing' | 'completed' | 'failed' | 'upload_complete' | 'description_complete' | 'prompts_complete' | 'cover_complete'
  error_message?: string
  watermark_text?: string | null
  watermark_location?: string | null
  cover_image_aspect_ratio?: string | null // Aspect ratio of the cover image (e.g., "16:9", "9:16", "1:1")
  photo_only?: boolean // If true, workflow skips video generation and only produces a cover image
  downloaded?: boolean // Whether user has downloaded the video
  download_credits_used?: number // Credits used for downloading (60% of total)
  cover_task_id?: string | null
  video_task_id?: string | null
  current_step?: 'describing' | 'generating_prompts' | 'generating_cover' | 'generating_video' | 'completed'
  progress_percentage?: number
  last_processed_at?: string
  selected_product_id?: string | null // Reference to user_products table
  video_aspect_ratio?: string // Video aspect ratio, defaults to '16:9'
  video_generation_prompt?: Record<string, unknown> // NEW: JSONB field containing the prompt used for video generation
  created_at: string
  updated_at: string
}

// Database types for multi_variant_projects table
export interface MultiVariantProject {
  id: string
  user_id: string
  elements_data?: Record<string, unknown>
  cover_task_id?: string
  video_task_id?: string
  cover_image_url?: string
  video_url?: string
  status: 'pending' | 'generating_cover' | 'generating_video' | 'completed' | 'failed'
  current_step: 'waiting' | 'generating_cover' | 'generating_video' | 'completed'
  credits_cost: number
  downloaded: boolean
  error_message?: string
  created_at: string
  updated_at: string
  last_processed_at?: string
  progress_percentage?: number
  original_image_url?: string
  product_description?: Record<string, unknown>
  video_model?: string
  download_credits_used: number
  watermark_text?: string
  watermark_location?: string
  cover_image_aspect_ratio?: string // Aspect ratio of the cover image (e.g., "16:9", "9:16", "1:1")
  image_prompt?: Record<string, unknown>
  photo_only: boolean
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

// Database types for user_products table
export interface UserProduct {
  id: string
  user_id: string
  product_name: string
  description?: string
  created_at: string
  updated_at: string
  user_product_photos?: UserProductPhoto[]
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
      multi_variant_ads_projects: {
        Row: MultiVariantProject
        Insert: Omit<MultiVariantProject, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MultiVariantProject, 'id' | 'created_at' | 'updated_at'>>
      }
      user_photos: {
        Row: UserPhoto
        Insert: Omit<UserPhoto, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserPhoto, 'id' | 'created_at' | 'updated_at'>>
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

// (Removed) uploadIdentityImageToStorage – deprecated with YouTube Thumbnail removal

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
  
  return data || []
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
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

  // Optionally delete from storage (uncomment if you want hard delete)
  // const filePath = `user-photos/${photo.file_name}`
  // await supabase.storage.from('images').remove([filePath])
}

// Upload product photo to storage in the correct product folder
export const uploadProductPhotoToStorage = async (file: File, userId: string) => {
  console.log(`[uploadProductPhotoToStorage] Starting upload for user: ${userId}, file: ${file.name} (${file.size} bytes)`);
  const fileName = `${userId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const filePath = `product/${fileName}`
  const supabase = getSupabase()

  // Upload to storage
  console.log(`[uploadProductPhotoToStorage] Uploading to storage path: ${filePath}`);
  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
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
