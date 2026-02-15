import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { IMAGE_MODELS } from '@/lib/constants';

const KIE_UPLOAD_ENDPOINT = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_ENDPOINT = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_RECORD_INFO_ENDPOINT = 'https://api.kie.ai/api/v1/jobs/recordInfo';

type AssetType = 'product' | 'avatar';

type AnglePreset = {
  key: string;
  label: string;
  prompt: string;
};

const ANGLE_PRESETS: Record<AssetType, AnglePreset[]> = {
  product: [
    {
      key: 'front_left_45',
      label: '45° Front Left',
      prompt:
        'Generate a realistic product photo from a 45-degree front-left angle. Keep the same product identity, materials, labels, colors, and proportions. Studio lighting, clean background, high detail.'
    },
    {
      key: 'front_right_45',
      label: '45° Front Right',
      prompt:
        'Generate a realistic product photo from a 45-degree front-right angle. Keep the same product identity, materials, labels, colors, and proportions. Studio lighting, clean background, high detail.'
    },
    {
      key: 'back_view',
      label: 'Back View',
      prompt:
        'Generate a realistic product photo from a centered back view angle. Keep the same product identity, shape language, materials, and design details. Studio lighting, clean background, high detail.'
    }
  ],
  avatar: [
    {
      key: 'left_45_portrait',
      label: '45° Left Portrait',
      prompt:
        'Generate a photorealistic portrait of the same person from a 45-degree left angle. Preserve identity, facial features, hairstyle, skin tone, and clothing style. Clean background, natural lighting.'
    },
    {
      key: 'right_45_portrait',
      label: '45° Right Portrait',
      prompt:
        'Generate a photorealistic portrait of the same person from a 45-degree right angle. Preserve identity, facial features, hairstyle, skin tone, and clothing style. Clean background, natural lighting.'
    },
    {
      key: 'side_profile',
      label: 'Side Profile',
      prompt:
        'Generate a photorealistic side-profile portrait of the same person. Preserve identity, facial features, hairstyle, skin tone, and clothing style. Clean background, natural lighting.'
    }
  ]
};

function getImageExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);
  if (!match) return 'png';
  const ext = match[1].toLowerCase();
  return ext === 'jpg' ? 'jpeg' : ext;
}

function parseResultUrl(taskData: Record<string, unknown>): string | null {
  const resultJsonRaw = taskData.resultJson;
  if (typeof resultJsonRaw === 'string') {
    try {
      const parsed = JSON.parse(resultJsonRaw) as { resultUrls?: string[] };
      if (Array.isArray(parsed.resultUrls) && parsed.resultUrls[0]) {
        return parsed.resultUrls[0];
      }
    } catch {
      // ignore parse errors and continue fallback parsing
    }
  }

  const responseObj = taskData.response as { resultUrls?: string[] } | undefined;
  if (Array.isArray(responseObj?.resultUrls) && responseObj.resultUrls[0]) {
    return responseObj.resultUrls[0];
  }

  const flatResultUrls = taskData.resultUrls as string[] | undefined;
  if (Array.isArray(flatResultUrls) && flatResultUrls[0]) {
    return flatResultUrls[0];
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }

    const body = await request.json();
    const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl : '';
    const assetType = body?.assetType === 'avatar' ? 'avatar' : body?.assetType === 'product' ? 'product' : null;
    const parsedExistingCount = Number(body?.existingReferenceCount);
    const existingReferenceCount = Number.isFinite(parsedExistingCount)
      ? Math.max(0, Math.min(Math.floor(parsedExistingCount), 3))
      : 0;
    const maxGeneratableCount = Math.max(0, 3 - existingReferenceCount);
    const parsedCount = Number(body?.count);
    const requestedCount = Number.isFinite(parsedCount)
      ? Math.floor(parsedCount)
      : maxGeneratableCount;
    const count = Math.max(1, Math.min(requestedCount, maxGeneratableCount || 1));

    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'A valid imageDataUrl is required' }, { status: 400 });
    }

    if (!assetType) {
      return NextResponse.json({ error: 'assetType must be avatar or product' }, { status: 400 });
    }

    const extension = getImageExtensionFromDataUrl(imageDataUrl);

    const uploadResponse = await fetchWithRetry(KIE_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base64Data: imageDataUrl,
        uploadPath: `assets/${assetType}/ai-reference-angles`,
        fileName: `${assetType}-primary-${Date.now()}.${extension}`
      })
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.text();
      return NextResponse.json({ error: 'Failed to upload source image', details: uploadError }, { status: uploadResponse.status });
    }

    const uploadResult = await uploadResponse.json();
    const sourceImageUrl = uploadResult?.data?.downloadUrl as string | undefined;

    if (!uploadResult?.success || !sourceImageUrl) {
      return NextResponse.json({ error: uploadResult?.msg || 'Source image upload failed' }, { status: 500 });
    }

    if (maxGeneratableCount <= 0) {
      return NextResponse.json({ error: 'Reference images are already full (3/3).' }, { status: 400 });
    }

    const presets = ANGLE_PRESETS[assetType].slice(
      existingReferenceCount,
      existingReferenceCount + count
    );
    const tasks = await Promise.all(
      presets.map(async (preset) => {
        const createTaskResponse = await fetchWithRetry(KIE_CREATE_TASK_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.KIE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: IMAGE_MODELS.nano_banana,
            input: {
              prompt: preset.prompt,
              image_urls: [sourceImageUrl],
              output_format: 'png',
              image_size: assetType === 'avatar' ? '9:16' : '1:1'
            }
          })
        }, 3, 30000);

        if (!createTaskResponse.ok) {
          const taskError = await createTaskResponse.text();
          throw new Error(`Failed to create ${preset.label} task: ${taskError}`);
        }

        const taskResult = await createTaskResponse.json();
        const taskId = taskResult?.data?.taskId as string | undefined;

        if (taskResult?.code !== 200 || !taskId) {
          throw new Error(taskResult?.msg || `Failed to create ${preset.label} task`);
        }

        return {
          key: preset.key,
          label: preset.label,
          taskId
        };
      })
    );

    return NextResponse.json({
      success: true,
      tasks,
      sourceImageUrl
    });
  } catch (error) {
    console.error('[ai-reference-angles] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const taskIds = searchParams.getAll('taskId').filter(Boolean);

    if (!taskIds.length) {
      return NextResponse.json({ error: 'At least one taskId is required' }, { status: 400 });
    }

    const statuses = await Promise.all(
      taskIds.map(async (taskId) => {
        const response = await fetchWithRetry(`${KIE_RECORD_INFO_ENDPOINT}?taskId=${encodeURIComponent(taskId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${process.env.KIE_API_KEY}`
          }
        }, 3, 15000);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to query task ${taskId}: ${errorText}`);
        }

        const payload = await response.json();
        if (payload?.code !== 200 || !payload?.data) {
          throw new Error(payload?.msg || `Failed to query task ${taskId}`);
        }

        const taskData = payload.data as Record<string, unknown>;
        const rawState = typeof taskData.state === 'string' ? taskData.state.toLowerCase() : 'unknown';
        const imageUrl = rawState === 'success' ? parseResultUrl(taskData) : null;

        let status: 'pending' | 'success' | 'failed' = 'pending';
        if (rawState === 'success') {
          status = imageUrl ? 'success' : 'pending';
        } else if (rawState === 'fail' || rawState === 'failed') {
          status = 'failed';
        }

        return {
          taskId,
          status,
          imageUrl,
          failMsg: typeof taskData.failMsg === 'string' ? taskData.failMsg : null
        };
      })
    );

    return NextResponse.json({ success: true, statuses });
  } catch (error) {
    console.error('[ai-reference-angles] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
