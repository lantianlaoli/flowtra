import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabaseAdmin } from '@/lib/supabase'

export function createSupabaseAdminClient(): SupabaseClient {
  return getSupabaseAdmin()
}
