import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { getMultiVariantItemsStatus } from '@/lib/multi-variant-ads-workflow';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    if (!idsParam) return NextResponse.json({ error: 'ids is required' }, { status: 400 });
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    const result = await getMultiVariantItemsStatus(ids);
    if (!result.success) return NextResponse.json({ error: result.error || 'Failed to fetch items' }, { status: 500 });
    return NextResponse.json({ success: true, items: result.items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}