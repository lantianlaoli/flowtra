import { Buffer } from 'buffer';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildCreatorVideoPath, getFileExtension } from '@/lib/storage/paths';
import { buildStorageRef } from '@/lib/storage/ops';
import { STORAGE_BUCKETS } from '@/lib/storage/types';

const sanitizeIdentifier = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export const downloadVideoBuffer = async (url: string, maxRetries: number = 5) => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download video (${response.status})`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'video/mp4';
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType
      };
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = 600 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to download video');
};

export const uploadCreatorVideoToStorage = async ({
  userId,
  creatorVideoId,
  fileName,
  buffer,
  contentType
}: {
  userId: string;
  creatorVideoId?: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string | null;
}) => {
  const supabase = getSupabaseAdmin();
  const filePath = buildCreatorVideoPath({
    userId,
    creatorVideoId: sanitizeIdentifier(creatorVideoId || crypto.randomUUID()),
    extension: getFileExtension(fileName, 'mp4'),
    variant: 'source'
  });

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.userVideos)
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: contentType || 'video/mp4'
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const ref = buildStorageRef(supabase, STORAGE_BUCKETS.userVideos, data.path);

  return {
    bucket: ref.bucket,
    path: ref.path,
    publicUrl: ref.publicUrl
  };
};
