import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

/**
 * Get TikTok User Connection Info
 *
 * Returns the current user's TikTok connection information if they have one.
 * Returns display_name, avatar_url, and connection status.
 */
export async function GET() {
  try {
    // Check if user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's TikTok connection from database
    const { data, error } = await supabase
      .from('user_tiktok_connections')
      .select('tiktok_open_id, display_name, avatar_url, created_at, scope')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching TikTok connection:', error);
      return NextResponse.json(
        { error: 'Failed to fetch TikTok connection' },
        { status: 500 }
      );
    }

    // Return connection status
    if (!data) {
      return NextResponse.json({
        connected: false,
        connection: null,
      });
    }

    return NextResponse.json({
      connected: true,
      connection: {
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        connected_at: data.created_at,
        scope: data.scope,
        tiktok_open_id: data.tiktok_open_id,
      },
    });
  } catch (error) {
    console.error('Error fetching TikTok connection info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
