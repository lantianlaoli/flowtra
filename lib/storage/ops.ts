import type { SupabaseClient } from '@supabase/supabase-js'
import type { StorageBucket, StorageObjectRef } from './types'

const PUBLIC_URL_PATTERN = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/

export const getPublicStorageUrl = (
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string
) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl

export const buildStorageRef = (
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string
): StorageObjectRef => ({
  bucket,
  path,
  publicUrl: getPublicStorageUrl(supabase, bucket, path),
})

export const parseStorageObjectRefFromPublicUrl = (publicUrl: string | null | undefined) => {
  if (!publicUrl) {
    return null
  }

  const match = publicUrl.match(PUBLIC_URL_PATTERN)
  if (!match) {
    return null
  }

  return {
    bucket: decodeURIComponent(match[1]),
    path: decodeURIComponent(match[2]),
  }
}

export const removeStorageObject = async (
  supabase: SupabaseClient,
  bucket: string,
  path: string
) => {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) {
    throw new Error(`Failed to delete storage object: ${error.message}`)
  }
}

export const removeStorageObjectRef = async (
  supabase: SupabaseClient,
  ref: Pick<StorageObjectRef, 'bucket' | 'path'>
) => {
  await removeStorageObject(supabase, ref.bucket, ref.path)
}

export const removeStorageObjectByUrl = async (
  supabase: SupabaseClient,
  publicUrl: string | null | undefined
) => {
  const ref = parseStorageObjectRefFromPublicUrl(publicUrl)
  if (!ref) {
    return
  }

  await removeStorageObject(supabase, ref.bucket, ref.path)
}

export const removeStorageObjectWithFallback = async (
  supabase: SupabaseClient,
  options: {
    bucket?: string | null
    path?: string | null
    publicUrl?: string | null
  }
) => {
  if (options.bucket && options.path) {
    await removeStorageObject(supabase, options.bucket, options.path)
    return
  }

  await removeStorageObjectByUrl(supabase, options.publicUrl)
}
