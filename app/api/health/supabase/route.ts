import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    console.log('[Health Check] Testing Supabase connection...');

    const supabase = getSupabaseAdmin();
    console.log('[Health Check] Supabase client initialized');

    // Try a simple SELECT query to test connectivity
    const { data, error, status } = await supabase
      .from('competitor_ads')
      .select('id')
      .limit(1);

    if (error) {
      console.error('[Health Check] Supabase query error:', {
        message: error.message,
        code: error.code,
        status
      });
      return NextResponse.json(
        {
          status: 'error',
          message: 'Supabase connection failed',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    console.log('[Health Check] Supabase connection successful');
    return NextResponse.json({
      status: 'ok',
      message: 'Supabase connection is working',
      recordsFound: data?.length || 0
    });
  } catch (error) {
    console.error('[Health Check] Unexpected error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Unexpected error during health check',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
