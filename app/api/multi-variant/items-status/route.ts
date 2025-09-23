import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { auth } from '@clerk/nextjs/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
      return NextResponse.json({ error: 'IDs parameter is required' }, { status: 400 });
    }

    const ids = idsParam.split(',').filter(id => id.trim());
    if (!ids.length) {
      return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: items, error } = await supabase
      .from('multi_variant_projects')
      .select('*')
      .in('id', ids)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching multi-variant items status:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      items: items || []
    });

  } catch (error) {
    console.error('Multi-variant items status error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}