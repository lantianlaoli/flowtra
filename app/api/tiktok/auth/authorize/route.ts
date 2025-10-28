import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'crypto';

/**
 * TikTok OAuth Authorization Endpoint
 *
 * Initiates the TikTok OAuth flow by redirecting users to TikTok's authorization page.
 * Generates a CSRF state token for security.
 */
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get TikTok OAuth credentials from environment
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI ||
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/tiktok/auth/callback`;

    if (!clientKey) {
      console.error('TIKTOK_CLIENT_KEY not configured');
      return NextResponse.json(
        { error: 'TikTok integration not configured' },
        { status: 500 }
      );
    }

    // Generate CSRF state token
    const csrfState = randomBytes(32).toString('hex');

    // Build TikTok authorization URL
    const scopes = 'user.info.basic,video.publish';
    const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
    authUrl.searchParams.append('client_key', clientKey);
    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('state', csrfState);

    // Create response with redirect
    const response = NextResponse.redirect(authUrl.toString());

    // Store CSRF state in cookie for validation in callback
    response.cookies.set('tiktok_oauth_state', csrfState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Store user ID for callback
    response.cookies.set('tiktok_oauth_user', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error initiating TikTok OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate TikTok authorization' },
      { status: 500 }
    );
  }
}
