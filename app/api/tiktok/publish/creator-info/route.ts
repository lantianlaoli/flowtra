import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { createDecipheriv } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

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

const CANNOT_POST_ERROR_CODES = new Set([
  'spam_risk_user_banned_from_posting',
  'spam_risk_too_many_posts',
  'reached_active_user_cap'
]);

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: connection, error: connectionError } = await supabase
      .from('user_tiktok_connections')
      .select('access_token, token_expires_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json({ success: false, error: 'TikTok account not connected' }, { status: 400 });
    }

    const expiresAt = new Date(connection.token_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'TikTok token expired. Please reconnect your account.' },
        { status: 400 }
      );
    }

    const accessToken = decryptToken(connection.access_token);

    const response = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: payload?.error?.message || 'Failed to fetch creator info' },
        { status: 500 }
      );
    }

    if (payload?.error?.code && payload.error.code !== 'ok') {
      if (CANNOT_POST_ERROR_CODES.has(payload.error.code)) {
        return NextResponse.json({
          success: true,
          data: {
            canPost: false,
            cannotPostReason: payload.error.message || 'TikTok cannot accept new posts right now.'
          }
        });
      }

      return NextResponse.json(
        { success: false, error: payload.error.message || 'Failed to fetch creator info' },
        { status: 500 }
      );
    }

    const data = payload?.data || {};

    return NextResponse.json({
      success: true,
      data: {
        creatorAvatarUrl: data.creator_avatar_url || null,
        creatorUsername: data.creator_username || null,
        creatorNickname: data.creator_nickname || null,
        privacyLevelOptions: data.privacy_level_options || [],
        commentDisabled: !!data.comment_disabled,
        duetDisabled: !!data.duet_disabled,
        stitchDisabled: !!data.stitch_disabled,
        maxVideoPostDurationSec: data.max_video_post_duration_sec ?? null,
        canPost: true
      }
    });
  } catch (error) {
    console.error('Error fetching TikTok creator info:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
