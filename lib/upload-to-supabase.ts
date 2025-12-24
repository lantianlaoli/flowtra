import { getSupabase } from './supabase';

/**
 * Upload a file directly to Supabase Storage from the client
 * This bypasses API routes and avoids FormData parsing issues
 *
 * @param file - File to upload
 * @param bucket - Supabase storage bucket name
 * @param path - File path in the bucket
 * @returns Promise with publicUrl and path
 */
export async function uploadFileToSupabase(
  file: File,
  bucket: string,
  path: string
): Promise<{ publicUrl: string; path: string }> {
  console.log(`[uploadFileToSupabase] Starting upload to ${bucket}/${path}`);

  const supabase = getSupabase();

  // Upload file
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (error) {
    console.error('[uploadFileToSupabase] Upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  console.log(`[uploadFileToSupabase] ✅ Upload complete: ${publicUrl}`);

  return {
    publicUrl,
    path: data.path
  };
}

/**
 * Delete a file from Supabase Storage
 *
 * @param bucket - Supabase storage bucket name
 * @param path - File path in the bucket
 */
export async function deleteFileFromSupabase(
  bucket: string,
  path: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('[deleteFileFromSupabase] Delete error:', error);
    throw new Error(`Delete failed: ${error.message}`);
  }

  console.log(`[deleteFileFromSupabase] ✅ File deleted: ${bucket}/${path}`);
}
