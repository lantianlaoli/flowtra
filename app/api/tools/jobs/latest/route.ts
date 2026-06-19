import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getToolGenerationJobsByUser, type ToolKey } from '@/lib/tools/job-store';

const TOOL_KEYS: ToolKey[] = [
  'ai-reference-angle',
  'image-clone',
  'image-clone-bulk',
  'ad-short-film',
  'ecommerce-listing-studio',
  'social-cover-generator',
];

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const toolKey = searchParams.get('toolKey') as ToolKey | null;
    const maxAgeMinutes = Number(searchParams.get('maxAgeMinutes') ?? '180');

    if (!toolKey || !TOOL_KEYS.includes(toolKey)) {
      return NextResponse.json({ error: 'Invalid toolKey' }, { status: 400 });
    }

    const [job] = await getToolGenerationJobsByUser(userId, toolKey);
    if (!job) {
      return NextResponse.json({ success: true, job: null });
    }

    const maxAgeMs = Number.isFinite(maxAgeMinutes) && maxAgeMinutes > 0 ? maxAgeMinutes * 60 * 1000 : 0;
    const updatedAt = new Date(job.updated_at).getTime();
    if (maxAgeMs > 0 && Number.isFinite(updatedAt) && Date.now() - updatedAt > maxAgeMs) {
      return NextResponse.json({ success: true, job: null });
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('[tools/jobs/latest] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
