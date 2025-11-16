import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
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

/**
 * Check TikTok Video Publishing Status
 *
 * This endpoint:
 * 1. Checks TikTok connection
 * 2. Calls TikTok status API with publish_id
 * 3. Returns current status and post info
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
    const body = await request.json();
    const { publishId } = body;

    // Validate required fields
    if (!publishId) {
      return NextResponse.json(
        { success: false, error: 'Missing publish_id' },
        { status: 400 }
      );
    }

    // Check TikTok connection
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

    // Fetch publish status from TikTok
    const statusResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          publish_id: publishId
        })
      }
    );

    if (!statusResponse.ok) {
      const errorData = await statusResponse.text();
      console.error('TikTok status fetch failed:', errorData);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch publish status' },
        { status: 500 }
      );
    }

    const statusData = await statusResponse.json();

    if (statusData.error?.code !== 'ok') {
      console.error('TikTok status error:', statusData.error);
      return NextResponse.json(
        { success: false, error: statusData.error?.message || 'Status fetch failed' },
        { status: 500 }
      );
    }

    // Extract status information
    const { status, fail_reason, publicaly_available_post_id } = statusData.data;

    // Return status information
    return NextResponse.json({
      success: true,
      status,
      failReason: fail_reason,
      postId: publicaly_available_post_id?.[0] || null,
      // Status can be: PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, PROCESSING_TRANSCODING,
      // SEND_TO_USER_INBOX, PUBLISH_COMPLETE, FAILED
      isComplete: status === 'PUBLISH_COMPLETE',
      isFailed: status === 'FAILED'
    });

  } catch (error) {
    console.error('Error checking TikTok publish status:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
