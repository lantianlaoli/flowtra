import { NextRequest, NextResponse } from 'next/server';
import { submitUrlToIndex } from '@/lib/google-indexing';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  try {
    // Verify CRON_SECRET security token
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { urls } = await request.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'URLs array required' }, { status: 400 });
    }

    console.log(`[Remove URLs] Processing ${urls.length} URLs...`);

    const results = [];
    let successful = 0;
    let failed = 0;

    // Submit URL deletion requests one by one
    for (const url of urls) {
      const result = await submitUrlToIndex(url, 'URL_DELETED');

      results.push({ url, success: result.success, error: result.error });

      if (result.success) {
        successful++;
        console.log(`✅ Removal submitted: ${url}`);
      } else {
        failed++;
        console.error(`❌ Failed: ${url} - ${result.error}`);
      }

      // Rate limiting: 200ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      success: true,
      total: urls.length,
      successful,
      failed,
      results
    });
  } catch (error) {
    console.error('[Remove URLs] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
