import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createCipheriv, randomBytes } from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Encryption helpers for storing tokens securely
const ENCRYPTION_KEY = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY ||
  process.env.TIKTOK_CLIENT_SECRET!.slice(0, 32).padEnd(32, '0');
const ALGORITHM = 'aes-256-cbc';

function encryptToken(token: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Note: decryptToken is not used in this file but may be needed for token refresh in the future
// function decryptToken(encrypted: string): string {
//   const parts = encrypted.split(':');
//   const iv = Buffer.from(parts[0], 'hex');
//   const encryptedText = parts[1];
//   const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
//   let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
//   decrypted += decipher.final('utf8');
//   return decrypted;
// }

/**
 * TikTok OAuth Callback Endpoint
 *
 * Handles the OAuth callback from TikTok:
 * 1. Validates CSRF state token
 * 2. Exchanges authorization code for access token
 * 3. Fetches user info from TikTok
 * 4. Stores connection in database
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('TikTok OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/account?tiktok_error=${encodeURIComponent(errorDescription || error)}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/account?tiktok_error=missing_parameters`
      );
    }

    // Validate CSRF state token
    const storedState = request.cookies.get('tiktok_oauth_state')?.value;
    const userId = request.cookies.get('tiktok_oauth_user')?.value;

    if (!storedState || storedState !== state) {
      console.error('CSRF state mismatch');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/account?tiktok_error=invalid_state`
      );
    }

    if (!userId) {
      console.error('User ID not found in callback');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/account?tiktok_error=session_expired`
      );
    }

    // Exchange authorization code for access token
    const clientKey = process.env.TIKTOK_CLIENT_KEY!;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET!;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/tiktok/auth/callback`;

    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/account?tiktok_error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const {
      access_token,
      refresh_token,
      expires_in,
      scope,
    } = tokenData;

    // Fetch user info from TikTok
    const userInfoResponse = await fetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name',
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.text();
      console.error('User info fetch failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/account?tiktok_error=user_info_failed`
      );
    }

    const userInfoData = await userInfoResponse.json();
    const userInfo = userInfoData.data.user;

    // Calculate token expiry time
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(access_token);
    const encryptedRefreshToken = encryptToken(refresh_token);

    // Store or update connection in database
    const { error: dbError } = await supabase
      .from('user_tiktok_connections')
      .upsert(
        {
          user_id: userId,
          tiktok_open_id: userInfo.open_id,
          tiktok_union_id: userInfo.union_id || null,
          display_name: userInfo.display_name,
          avatar_url: userInfo.avatar_url || null,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: expiresAt.toISOString(),
          scope: scope,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'tiktok_open_id',
        }
      );

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/account?tiktok_error=database_error`
      );
    }

    // Success! Redirect back to account page
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/account?tiktok_success=true`
    );

    // Clear OAuth cookies
    response.cookies.delete('tiktok_oauth_state');
    response.cookies.delete('tiktok_oauth_user');

    return response;
  } catch (error) {
    console.error('Error in TikTok OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/account?tiktok_error=unexpected_error`
    );
  }
}
