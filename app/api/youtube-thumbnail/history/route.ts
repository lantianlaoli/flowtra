import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();

    const { data: history, error } = await supabase
      .from('thumbnail_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch thumbnail history:', error);
      return NextResponse.json({ message: 'Failed to fetch history' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      history: history || []
    });

  } catch (error) {
    console.error('History fetch error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}