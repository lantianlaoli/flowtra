import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { subscribeToJobSse, getJobById } from '@/lib/ai-reference-angle-store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobIds = searchParams.getAll('jobId').filter(Boolean);

  if (!jobIds.length) {
    return NextResponse.json({ error: 'At least one jobId is required' }, { status: 400 });
  }

  // Verify user owns all requested jobs
  for (const jobId of jobIds) {
    const job = getJobById(jobId);
    if (!job || job.user_id !== userId) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
  }

  const stream = new ReadableStream({
    start(controller) {
      const unsubscribes: Array<() => void> = [];

      for (const jobId of jobIds) {
        const job = getJobById(jobId);
        if (job) {
          const data = JSON.stringify(job);
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }

        const unsubscribe = subscribeToJobSse(jobId, controller);
        unsubscribes.push(unsubscribe);
      }

      request.signal.addEventListener('abort', () => {
        unsubscribes.forEach((unsub) => unsub());
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
