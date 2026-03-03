import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NON_AGENT_IMAGE_MODEL, NON_AGENT_IMAGE_OUTPUT_FORMAT, NON_AGENT_IMAGE_RESOLUTION } from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import {
  buildShareImagePrompt,
  resolveClerkDisplayName,
} from '@/lib/competitor-share-image';

const KIE_API_BASE_URL = 'https://api.kie.ai/api/v1/jobs';

const shotSchema = z.object({
  shot_id: z.number().optional(),
  start_time: z.string().optional().default(''),
  action: z.string().optional().default(''),
  first_frame_description: z.string().optional().default(''),
  audio: z.string().optional().default(''),
});

const analysisSchema = z.object({
  name: z.string().min(1),
  detected_language: z.string().min(1),
  video_duration_seconds: z.number().nonnegative(),
  shots: z.array(shotSchema).min(1),
});

const shareImageRequestSchema = z.object({
  analysis: analysisSchema,
  videoUrl: z.string().url().optional(),
  tiktokUrl: z.string().url().optional(),
});

function normalizeTaskState(state: string | null | undefined): 'waiting' | 'success' | 'fail' | 'unknown' {
  const normalized = state?.toLowerCase().trim();
  if (!normalized) return 'unknown';
  if (normalized === 'success') return 'success';
  if (normalized === 'fail' || normalized === 'failed') return 'fail';
  if (
    normalized === 'waiting' ||
    normalized === 'pending' ||
    normalized === 'running' ||
    normalized === 'processing' ||
    normalized === 'queued'
  ) {
    return 'waiting';
  }

  return 'unknown';
}

function extractResultUrl(taskData: Record<string, unknown>): string | null {
  const resultJson = typeof taskData.resultJson === 'string' ? taskData.resultJson : null;
  if (resultJson) {
    try {
      const parsed = JSON.parse(resultJson) as { resultUrls?: string[] };
      if (Array.isArray(parsed.resultUrls) && parsed.resultUrls[0]) {
        return parsed.resultUrls[0];
      }
    } catch (error) {
      console.warn('[Share Image] Failed to parse KIE resultJson:', error);
    }
  }

  const responseResultUrls = (taskData.response as { resultUrls?: string[] } | undefined)?.resultUrls;
  if (Array.isArray(responseResultUrls) && responseResultUrls[0]) {
    return responseResultUrls[0];
  }

  const flatResultUrls = taskData.resultUrls as string[] | undefined;
  if (Array.isArray(flatResultUrls) && flatResultUrls[0]) {
    return flatResultUrls[0];
  }

  return null;
}

async function getAuthenticatedShareIdentity(userId: string): Promise<{ creatorName: string; creatorUsername: string }> {
  try {
    const client = typeof clerkClient === 'function' ? await clerkClient() : clerkClient;
    const user = await client.users.getUser(userId);
    const primaryEmail = user.emailAddresses?.[0]?.emailAddress || null;
    const creatorName = resolveClerkDisplayName({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      emailAddress: primaryEmail,
    });
    const emailLocalPart = primaryEmail?.split('@')[0]?.trim() || '';
    const creatorUsername = user.username?.trim()
      ? user.username.trim().replace(/^@+/, '')
      : emailLocalPart
        ? emailLocalPart.replace(/^@+/, '')
        : creatorName.replace(/\s+/g, '').replace(/^@+/, '').toLowerCase() || 'flowtra-user';

    return { creatorName, creatorUsername };
  } catch (error) {
    console.warn('[Share Image] Failed to load Clerk user, using fallback name:', error);
    return {
      creatorName: 'Flowtra Creator',
      creatorUsername: 'flowtra-user',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const parsedBody = shareImageRequestSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json({ success: false, error: 'Invalid analysis payload' }, { status: 400 });
    }

    const { analysis } = parsedBody.data;
    const { creatorUsername } = await getAuthenticatedShareIdentity(userId);

    const prompt = buildShareImagePrompt({
      analysis,
      creatorUsername,
      generatedAt: new Date(),
    });
    const logoReferenceUrl = 'https://flowtra.store/twitter-image.png';
    console.log('[Share Image] Resolved creator username:', creatorUsername);

    const payload = {
      model: NON_AGENT_IMAGE_MODEL,
      input: {
        prompt,
        image_input: [logoReferenceUrl],
        aspect_ratio: '9:16',
        resolution: NON_AGENT_IMAGE_RESOLUTION,
        output_format: NON_AGENT_IMAGE_OUTPUT_FORMAT,
      },
    };

    const response = await fetchWithRetry(`${KIE_API_BASE_URL}/createTask`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }, 3, 30000);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Share Image] Failed to create KIE task:', errorText);
      return NextResponse.json({ success: false, error: 'Failed to start share image generation' }, { status: response.status });
    }

    const data = await response.json();
    if (data.code !== 200 || !data.data?.taskId) {
      console.error('[Share Image] KIE returned an error:', data);
      return NextResponse.json({ success: false, error: data.msg || 'Image generation provider rejected the request' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      taskId: data.data.taskId as string,
    });
  } catch (error) {
    console.error('[Share Image] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Task ID is required' }, { status: 400 });
    }

    const response = await fetchWithRetry(`${KIE_API_BASE_URL}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.KIE_API_KEY}`,
      },
    }, 3, 10000);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Share Image] Failed to poll KIE task:', errorText);
      return NextResponse.json({ success: false, error: 'Failed to check share image status' }, { status: response.status });
    }

    const data = await response.json();
    if (data.code !== 200) {
      return NextResponse.json({ success: false, error: data.msg || 'KIE API error' }, { status: 500 });
    }

    const taskData = (data.data ?? {}) as Record<string, unknown>;
    const status = normalizeTaskState(typeof taskData.state === 'string' ? taskData.state : null);
    const imageUrl = status === 'success' ? extractResultUrl(taskData) : null;

    return NextResponse.json({
      success: true,
      status,
      imageUrl,
      error: status === 'fail' ? ((taskData.failMsg as string | undefined) || 'Share image generation failed') : undefined,
    });
  } catch (error) {
    console.error('[Share Image] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
