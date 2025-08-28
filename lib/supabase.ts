import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazily initialize clients to avoid evaluating env vars during build time
let browserClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (browserClient) return browserClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

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
}

// Database types for user_history table
export interface UserHistory {
  id: string
  user_id: string
  original_image_url: string
  cover_image_url?: string
  video_url?: string
  product_description?: string
  creative_prompts?: Record<string, unknown>
  video_model: 'veo3' | 'veo3_fast'
  credits_used: number
  status: 'processing' | 'completed' | 'failed' | 'upload_complete' | 'description_complete' | 'prompts_complete' | 'cover_complete'
  error_message?: string
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
      user_history: {
        Row: UserHistory
        Insert: Omit<UserHistory, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<UserHistory, 'id' | 'created_at' | 'updated_at'>>
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
  const filePath = `covers/${fileName}`

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