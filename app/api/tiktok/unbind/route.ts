import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Unbind TikTok Account
 *
 * Removes the user's TikTok connection from the database.
 */
export async function POST() {
  try {
    // Check if user is authenticated
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Delete user's TikTok connection
    const { error } = await supabase
      .from('user_tiktok_connections')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Database error deleting TikTok connection:', error);
      return NextResponse.json(
        { error: 'Failed to unbind TikTok account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'TikTok account unbound successfully',
    });
  } catch (error) {
    console.error('Error unbinding TikTok account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
