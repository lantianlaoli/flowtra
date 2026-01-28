import { Buffer } from 'buffer';
import { getSupabaseAdmin } from '@/lib/supabase';

const STORAGE_BUCKET = 'competitor_videos';

const sanitizeFileName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, '_');

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
  fileName,
  buffer,
  contentType
}: {
  userId: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string | null;
}) => {
  const supabase = getSupabaseAdmin();
  const safeName = sanitizeFileName(fileName);
  const filePath = `creator-videos/${userId}/${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: contentType || 'video/mp4'
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return {
    path: data.path,
    publicUrl
  };
};

export const uploadCreatorVideoCoverToStorage = async ({
  userId,
  fileName,
  buffer,
  contentType
}: {
  userId: string;
  fileName: string;
  buffer: Buffer;
  contentType?: string | null;
}) => {
  const supabase = getSupabaseAdmin();
  const safeName = sanitizeFileName(fileName);
  const filePath = `creator-video-covers/${userId}/${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: contentType || 'image/png'
    });

  if (error) {
    throw new Error(`Cover upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  return {
    path: data.path,
    publicUrl
  };
};
