import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { redis } from '@/lib/redis';
import {
  getToolGenerationJob,
  getToolGenerationTasksByJobId,
} from '@/lib/tools/job-store';

export const dynamic = 'force-dynamic';

const PING_PREFIX = 'tool:job:';
const PING_SUFFIX = ':ping';
const POLL_INTERVAL_MS = 2000;
const MAX_STREAM_DURATION_MS = 3_600_000; // Keep long KIE video jobs connected for up to 60 minutes.

function pingKey(jobId: string) {
  return `${PING_PREFIX}${jobId}${PING_SUFFIX}`;
}

function isTerminal(status: string) {
  return status === 'completed' || status === 'failed';
}

function sse(data: unknown, event?: string) {
  const lines: string[] = [];
  if (event) lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push('');
  return new TextEncoder().encode(lines.join('\n') + '\n');
}

function sseComment(text: string) {
  return new TextEncoder().encode(`: ${text}\n\n`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: jobId } = await params;

  const job = await getToolGenerationJob(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: 'Job not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (job.user_id !== userId) {
    return new Response('Forbidden', { status: 403 });
  }

  let lastPing: string | null = null;
  let aborted = false;
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const initialTasks = await getToolGenerationTasksByJobId(jobId, { skipCache: true });
        controller.enqueue(sse({ job, tasks: initialTasks }, 'snapshot'));
        lastPing = await redis.get<string>(pingKey(jobId));

        if (isTerminal(job.status)) {
          controller.enqueue(sse({ job, tasks: initialTasks }, 'terminal'));
          controller.close();
          return;
        }
      } catch (err) {
        controller.enqueue(sse({ error: 'Failed to load initial state' }, 'error'));
        controller.close();
        return;
      }

      const interval = setInterval(async () => {
        if (aborted) {
          clearInterval(interval);
          return;
        }

        if (Date.now() - startTime > MAX_STREAM_DURATION_MS) {
          controller.enqueue(sse({ message: 'Stream timeout' }, 'timeout'));
          clearInterval(interval);
          controller.close();
          return;
        }

        try {
          const currentPing = await redis.get<string>(pingKey(jobId));

          if (currentPing !== lastPing) {
            const [updatedJob, updatedTasks] = await Promise.all([
              getToolGenerationJob(jobId),
              getToolGenerationTasksByJobId(jobId, { skipCache: true }),
            ]);

            if (updatedJob) {
              controller.enqueue(sse({ job: updatedJob, tasks: updatedTasks }, 'update'));
              lastPing = currentPing;

              if (isTerminal(updatedJob.status)) {
                controller.enqueue(sse({ job: updatedJob, tasks: updatedTasks }, 'terminal'));
                clearInterval(interval);
                controller.close();
                return;
              }
            }
          } else {
            controller.enqueue(sseComment('keepalive'));
          }
        } catch {
          controller.enqueue(sseComment('keepalive'));
        }
      }, POLL_INTERVAL_MS);
    },
    cancel() {
      aborted = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
