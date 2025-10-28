import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';
import {
  calculateChunks,
  uploadChunk,
  fetchVideoBuffer,
  validateVideo
} from '@/lib/tiktok-upload-helper';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Decryption helper (from callback route)
const ENCRYPTION_KEY = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY ||
  process.env.TIKTOK_CLIENT_SECRET!.slice(0, 32).padEnd(32, '0');
const ALGORITHM = 'aes-256-cbc';

function decryptToken(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = parts[1];
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

interface PublishRequest {
  historyId: string;
  title: string;
  privacyLevel: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableDuet?: boolean;
  disableComment?: boolean;
  disableStitch?: boolean;
  videoCoverTimestampMs?: number;
}

/**
 * Initialize TikTok Video Publishing
 *
 * This endpoint:
 * 1. Checks TikTok connection
 * 2. Fetches video from database
 * 3. Downloads video buffer
 * 4. Initiates TikTok upload
 * 5. Uploads video chunks
 * 6. Returns publish_id for status tracking
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: PublishRequest = await request.json();
    const {
      historyId,
      title,
      privacyLevel,
      disableDuet = false,
      disableComment = false,
      disableStitch = false,
      videoCoverTimestampMs = 1000
    } = body;

    // Validate required fields
    if (!historyId || !title) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Force SELF_ONLY privacy level due to unaudited app restriction
    // TikTok apps in development mode can only post private videos
    const forcedPrivacyLevel = 'SELF_ONLY';
    console.log(`[TikTok Publish] Privacy level: ${privacyLevel || 'not specified'} → forced to ${forcedPrivacyLevel} (unaudited app restriction)`);

    // 1. Check TikTok connection
    const { data: connection, error: connectionError } = await supabase
      .from('user_tiktok_connections')
      .select('access_token, token_expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json(
        { success: false, error: 'TikTok account not connected' },
        { status: 400 }
      );
    }

    // Check token expiry
    const expiresAt = new Date(connection.token_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'TikTok token expired. Please reconnect your account.' },
        { status: 400 }
      );
    }

    // Decrypt access token
    const accessToken = decryptToken(connection.access_token);

    // 2. Fetch video from database (check all ad types)
    let videoUrl: string | null = null;
    let videoFound = false;

    // Try standard_ads_projects
    const { data: standardAd } = await supabase
      .from('standard_ads_projects')
      .select('video_url, user_id, status')
      .eq('id', historyId)
      .maybeSingle();

    if (standardAd && standardAd.user_id === userId) {
      if (standardAd.status !== 'completed') {
        return NextResponse.json(
          { success: false, error: 'Video is not ready yet' },
          { status: 400 }
        );
      }
      videoUrl = standardAd.video_url;
      videoFound = true;
    }

    // Try multi_variant_ads_projects if not found
    if (!videoFound) {
      const { data: multiVariantAd } = await supabase
        .from('multi_variant_ads_projects')
        .select('video_url, user_id, status')
        .eq('id', historyId)
        .maybeSingle();

      if (multiVariantAd && multiVariantAd.user_id === userId) {
        if (multiVariantAd.status !== 'completed') {
          return NextResponse.json(
            { success: false, error: 'Video is not ready yet' },
            { status: 400 }
          );
        }
        videoUrl = multiVariantAd.video_url;
        videoFound = true;
      }
    }

    // Try character_ads_projects if still not found
    if (!videoFound) {
      const { data: characterAd } = await supabase
        .from('character_ads_projects')
        .select('merged_video_url, user_id, status')
        .eq('id', historyId)
        .maybeSingle();

      if (characterAd && characterAd.user_id === userId) {
        if (characterAd.status !== 'completed') {
          return NextResponse.json(
            { success: false, error: 'Video is not ready yet' },
            { status: 400 }
          );
        }
        videoUrl = characterAd.merged_video_url;
        videoFound = true;
      }
    }

    if (!videoFound || !videoUrl) {
      return NextResponse.json(
        { success: false, error: 'Video not found or you do not have access' },
        { status: 404 }
      );
    }

    console.log(`[TikTok Publish] Fetching video from: ${videoUrl}`);

    // 3. Download video buffer
    let videoBuffer: Buffer;
    try {
      console.log(`[TikTok Publish] Starting video download...`);
      videoBuffer = await fetchVideoBuffer(videoUrl);
      console.log(`[TikTok Publish] Video downloaded successfully, size: ${videoBuffer.length} bytes`);
    } catch (error) {
      console.error(`[TikTok Publish] Video download failed:`, error);
      return NextResponse.json(
        { success: false, error: `Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // 4. Validate video
    console.log(`[TikTok Publish] Validating video format...`);
    const validation = validateVideo(videoBuffer);
    if (!validation.valid) {
      console.error(`[TikTok Publish] Video validation failed:`, validation.error);
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    console.log(`[TikTok Publish] Video validation passed`);

    const videoSize = videoBuffer.length;
    console.log(`[TikTok Publish] Video size: ${(videoSize / 1024 / 1024).toFixed(2)} MB`);

    // 5. Calculate chunks
    console.log(`[TikTok Publish] Calculating chunks...`);
    const { chunkSize, totalChunks, chunks } = calculateChunks(videoSize);
    console.log(`[TikTok Publish] Chunking: ${totalChunks} chunks of ~${(chunkSize / 1024 / 1024).toFixed(2)} MB each`);

    // 6. Initialize TikTok upload
    console.log(`[TikTok Publish] Initializing TikTok upload...`);
    const initPayload = {
      post_info: {
        title,
        privacy_level: forcedPrivacyLevel,  // Always SELF_ONLY for unaudited apps
        disable_duet: disableDuet,
        disable_comment: disableComment,
        disable_stitch: disableStitch,
        video_cover_timestamp_ms: videoCoverTimestampMs
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks
      }
    };
    console.log(`[TikTok Publish] Init payload:`, JSON.stringify(initPayload, null, 2));

    const initResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(initPayload)
      }
    );

    console.log(`[TikTok Publish] Init response status: ${initResponse.status}`);

    if (!initResponse.ok) {
      const errorData = await initResponse.text();
      console.error(`[TikTok Publish] TikTok init failed (${initResponse.status}):`, errorData);
      return NextResponse.json(
        { success: false, error: `Failed to initialize TikTok upload: ${errorData}` },
        { status: 500 }
      );
    }

    const initData = await initResponse.json();
    console.log(`[TikTok Publish] Init response data:`, JSON.stringify(initData, null, 2));

    if (initData.error?.code !== 'ok') {
      console.error(`[TikTok Publish] TikTok init error:`, initData.error);
      return NextResponse.json(
        { success: false, error: initData.error?.message || 'TikTok init failed' },
        { status: 500 }
      );
    }

    const { publish_id, upload_url } = initData.data;
    console.log(`[TikTok Publish] Got publish_id: ${publish_id}`);
    console.log(`[TikTok Publish] Got upload_url: ${upload_url}`);

    // 7. Upload chunks sequentially
    console.log(`[TikTok Publish] Starting chunk upload (${chunks.length} chunks)...`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkBuffer = videoBuffer.slice(chunk.start, chunk.end + 1);

      console.log(`[TikTok Publish] Uploading chunk ${i + 1}/${chunks.length} (${(chunk.size / 1024 / 1024).toFixed(2)} MB, range ${chunk.start}-${chunk.end})...`);

      try {
        const startTime = Date.now();
        await uploadChunk(upload_url, chunkBuffer, chunk, videoSize);
        const duration = Date.now() - startTime;
        console.log(`[TikTok Publish] Chunk ${i + 1}/${chunks.length} uploaded successfully in ${duration}ms`);
      } catch (error) {
        console.error(`[TikTok Publish] Chunk ${i + 1} upload failed:`, error);
        if (error instanceof Error) {
          console.error(`[TikTok Publish] Error stack:`, error.stack);
        }
        return NextResponse.json(
          { success: false, error: `Chunk upload failed at ${i + 1}/${chunks.length}: ${error instanceof Error ? error.message : 'Unknown error'}` },
          { status: 500 }
        );
      }
    }

    console.log(`[TikTok Publish] All chunks uploaded successfully`);

    // Return publish_id for status tracking
    return NextResponse.json({
      success: true,
      publishId: publish_id,
      message: 'Video uploaded successfully. Processing...'
    });

  } catch (error) {
    console.error('Error in TikTok publish init:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
