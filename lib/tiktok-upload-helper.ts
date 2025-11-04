/**
 * TikTok Video Upload Helper Functions
 *
 * Provides utility functions for uploading videos to TikTok using the Content Posting API.
 * Includes chunked upload logic, status polling, and error handling.
 */

interface ChunkInfo {
  chunkIndex: number;
  start: number;
  end: number;
  size: number;
}

interface ChunkCalculationResult {
  chunkSize: number;
  totalChunks: number;
  chunks: ChunkInfo[];
}

const MIN_CHUNK_SIZE = 5 * 1024 * 1024;   // 5MB
const MAX_CHUNK_SIZE = 64 * 1024 * 1024;  // 64MB

/**
 * Calculate chunk parameters for video upload
 *
 * Rules:
 * - Videos < 5MB must be uploaded as a single chunk
 * - Chunks must be 5MB-64MB
 * - Chunks must be uploaded sequentially
 * - Max 1000 chunks
 *
 * @param videoSize Total video size in bytes
 * @param preferredChunkSize Preferred chunk size (default 10MB)
 * @returns Chunk calculation result with all chunk details
 */
export function calculateChunks(
  videoSize: number,
  preferredChunkSize: number = 10 * 1024 * 1024  // Default 10MB
): ChunkCalculationResult {
  // Videos smaller than 5MB must be uploaded whole
  if (videoSize < MIN_CHUNK_SIZE) {
    return {
      chunkSize: videoSize,
      totalChunks: 1,
      chunks: [{
        chunkIndex: 0,
        start: 0,
        end: videoSize - 1,
        size: videoSize
      }]
    };
  }

  // Ensure chunk size is within valid range
  let chunkSize = Math.max(
    MIN_CHUNK_SIZE,
    Math.min(MAX_CHUNK_SIZE, preferredChunkSize)
  );

  // Calculate total chunks
  const totalChunks = Math.ceil(videoSize / chunkSize);

  // Ensure we don't exceed max chunks
  if (totalChunks > 1000) {
    // Increase chunk size to stay under 1000 chunks
    chunkSize = Math.ceil(videoSize / 1000);
    if (chunkSize > MAX_CHUNK_SIZE) {
      throw new Error(`Video too large: ${videoSize} bytes exceeds maximum uploadable size`);
    }
  }

  // Generate chunk info for each chunk
  const chunks: ChunkInfo[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize - 1, videoSize - 1);
    const size = end - start + 1;

    chunks.push({
      chunkIndex: i,
      start,
      end,
      size
    });
  }

  return { chunkSize, totalChunks, chunks };
}

/**
 * Upload a single chunk to TikTok
 *
 * @param uploadUrl TikTok upload URL from init response
 * @param chunk Video chunk buffer
 * @param chunkInfo Chunk metadata (index, start, end)
 * @param totalSize Total video size
 */
export async function uploadChunk(
  uploadUrl: string,
  chunk: Buffer,
  chunkInfo: ChunkInfo,
  totalSize: number
): Promise<void> {
  const { start, end } = chunkInfo;

  // Convert Buffer to Uint8Array for fetch compatibility
  const uint8Array = new Uint8Array(chunk);

  console.log(`[uploadChunk] Uploading chunk ${chunkInfo.chunkIndex}: bytes ${start}-${end}/${totalSize} (${chunk.length} bytes)`);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': chunk.length.toString(),
      'Content-Range': `bytes ${start}-${end}/${totalSize}`
    },
    body: uint8Array
  });

  console.log(`[uploadChunk] Chunk ${chunkInfo.chunkIndex} response status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[uploadChunk] Chunk ${chunkInfo.chunkIndex} failed with status ${response.status}:`, errorText);
    throw new Error(`Chunk upload failed (${response.status}): ${errorText}`);
  }

  console.log(`[uploadChunk] Chunk ${chunkInfo.chunkIndex} uploaded successfully`);
}

/**
 * Upload complete video to TikTok with chunked upload
 *
 * @param uploadUrl TikTok upload URL from init response
 * @param videoBuffer Complete video buffer
 * @param onProgress Optional progress callback (0-100)
 */
export async function uploadVideo(
  uploadUrl: string,
  videoBuffer: Buffer,
  onProgress?: (progress: number) => void
): Promise<void> {
  const videoSize = videoBuffer.length;
  const { chunks } = calculateChunks(videoSize);

  console.log(`Uploading video: ${(videoSize / 1024 / 1024).toFixed(2)} MB in ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkBuffer = videoBuffer.slice(chunk.start, chunk.end + 1);

    console.log(`Uploading chunk ${i + 1}/${chunks.length} (${(chunk.size / 1024 / 1024).toFixed(2)} MB)...`);

    await uploadChunk(uploadUrl, chunkBuffer, chunk, videoSize);

    // Report progress
    if (onProgress) {
      const progress = Math.round(((i + 1) / chunks.length) * 100);
      onProgress(progress);
    }
  }

  console.log('Video upload complete');
}

/**
 * Poll TikTok publish status until completion or timeout
 *
 * @param publishId TikTok publish ID from init response
 * @param accessToken User's TikTok access token
 * @param options Polling options
 * @returns Final status and post information
 */
export async function pollPublishStatus(
  publishId: string,
  accessToken: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    onStatusChange?: (status: string) => void;
  } = {}
): Promise<{
  status: string;
  postId?: string;
  error?: string;
}> {
  const {
    maxAttempts = 60,      // Default 5 minutes (60 * 5s)
    intervalMs = 5000,     // Default 5 seconds
    onStatusChange
  } = options;

  let attempts = 0;
  let lastStatus = '';

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ publish_id: publishId })
        }
      );

      if (!response.ok) {
        throw new Error(`Status fetch failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.error?.code !== 'ok') {
        return {
          status: 'FAILED',
          error: data.error?.message || 'Unknown error'
        };
      }

      const status = data.data.status;

      // Notify status change
      if (status !== lastStatus) {
        lastStatus = status;
        console.log(`Status changed: ${status}`);
        if (onStatusChange) {
          onStatusChange(status);
        }
      }

      // Check if completed
      if (status === 'PUBLISH_COMPLETE') {
        const postId = data.data.publicaly_available_post_id?.[0];
        return {
          status: 'PUBLISH_COMPLETE',
          postId
        };
      }

      // Check if failed
      if (status === 'FAILED') {
        return {
          status: 'FAILED',
          error: 'TikTok rejected the video'
        };
      }

      // Still processing, wait and retry
      attempts++;
      await new Promise(resolve => setTimeout(resolve, intervalMs));

    } catch (error) {
      console.error(`Polling attempt ${attempts + 1} failed:`, error);
      attempts++;

      // If not the last attempt, wait and retry
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }

  // Timeout
  return {
    status: 'TIMEOUT',
    error: `Publish status polling timed out after ${maxAttempts} attempts`
  };
}

/**
 * Fetch video buffer from URL
 *
 * @param videoUrl Video URL (Supabase Storage or external)
 * @returns Video buffer
 */
export async function fetchVideoBuffer(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Validate video format and size
 *
 * @param videoBuffer Video buffer
 * @returns Validation result
 */
export function validateVideo(videoBuffer: Buffer): {
  valid: boolean;
  error?: string;
} {
  const videoSize = videoBuffer.length;
  const maxSize = 2 * 1024 * 1024 * 1024; // 2GB

  // Check size
  if (videoSize === 0) {
    return { valid: false, error: 'Video is empty' };
  }

  if (videoSize > maxSize) {
    return {
      valid: false,
      error: `Video too large: ${(videoSize / 1024 / 1024 / 1024).toFixed(2)} GB (max 2GB)`
    };
  }

  // Check if it's an MP4 file (basic check via magic bytes)
  // MP4 files typically start with 'ftyp' at offset 4
  const signature = videoBuffer.slice(4, 8).toString('ascii');
  if (!signature.includes('ftyp') && !signature.includes('mdat')) {
    return {
      valid: false,
      error: 'Video format may not be valid MP4. Please ensure video is in MP4 format with H.264 codec.'
    };
  }

  return { valid: true };
}

/**
 * Retry wrapper for async operations
 *
 * @param fn Function to retry
 * @param maxRetries Maximum retry attempts
 * @param baseDelay Base delay in milliseconds (exponential backoff)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;  // Last attempt failed
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Retry failed');
}
