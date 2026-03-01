import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';

const KIE_UPLOAD_ENDPOINT = 'https://kieai.redpandaai.co/api/file-base64-upload';
const KIE_CREATE_TASK_ENDPOINT = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_RECORD_INFO_ENDPOINT = 'https://api.kie.ai/api/v1/jobs/recordInfo';
const AI_REFERENCE_MODEL = 'nano-banana-2';
const AI_REFERENCE_RESOLUTION = '1K';
const AI_REFERENCE_OUTPUT_FORMAT = 'png';

type AssetType = 'product' | 'avatar' | 'universal';
type SourceAspect = 'portrait' | 'square' | 'landscape';

type AnglePreset = {
  key: string;
  label: string;
  prompt: string;
};

const STYLE_LOCK_SUFFIX = [
  'Maintain exact stylistic consistency with the reference image.',
  'Preserve the original visual medium, rendering approach, and image character.',
  'If the reference image is an illustration, animation frame, painting, sketch, 3D render, product render, or casual mobile photo, retain that format rather than converting it into a different visual style.',
  'Preserve the original color palette, lighting quality, tonal balance, contrast, saturation, texture treatment, and background atmosphere.',
  'Do not restyle, embellish, beautify, or reinterpret the reference.'
].join(' ');

function withStyleLock(prompt: string) {
  return `${prompt} ${STYLE_LOCK_SUFFIX}`;
}

const CAMERA_LEFT_DEFINITION =
  'The camera is positioned 45 degrees to the subject front-left. The generated image must clearly show more of the subject left side than the right side. Do not return a near-frontal view, and do not mirror the opposite angle.';

const CAMERA_RIGHT_DEFINITION =
  'The camera is positioned 45 degrees to the subject front-right. The generated image must clearly show more of the subject right side than the left side. Do not return a near-frontal view, and do not mirror the opposite angle.';

const ANGLE_PRESETS: Record<AssetType, AnglePreset[]> = {
  product: [
    {
      key: 'front_left_45',
      label: '45° Front Left',
      prompt: withStyleLock(
        `Generate the same product from a 45-degree front-left perspective. ${CAMERA_LEFT_DEFINITION} Show the left-front plane and left-side depth more prominently than the right side. Preserve the exact product identity, materials, labels, colors, proportions, and compositional structure. Maintain a clean background and high visual fidelity.`
      )
    },
    {
      key: 'front_right_45',
      label: '45° Front Right',
      prompt: withStyleLock(
        `Generate the same product from a 45-degree front-right perspective. ${CAMERA_RIGHT_DEFINITION} Show the right-front plane and right-side depth more prominently than the left side. Preserve the exact product identity, materials, labels, colors, proportions, and compositional structure. Maintain a clean background and high visual fidelity.`
      )
    },
    {
      key: 'back_view',
      label: 'Back View',
      prompt: withStyleLock(
        'Generate the same product from a centered rear view. Preserve the exact product identity, shape language, materials, labels, and design details. Maintain a clean background and high visual fidelity.'
      )
    }
  ],
  avatar: [
    {
      key: 'left_45_portrait',
      label: '45° Left Portrait',
      prompt: withStyleLock(
        `Generate the same person from a 45-degree left portrait angle. ${CAMERA_LEFT_DEFINITION} The viewer should see more of the left cheek, left jawline, and left ear than the right side of the face. Preserve identity, facial structure, hairstyle, skin tone, expression, posture, and clothing characteristics. Maintain a clean background and faithful lighting.`
      )
    },
    {
      key: 'right_45_portrait',
      label: '45° Right Portrait',
      prompt: withStyleLock(
        `Generate the same person from a 45-degree right portrait angle. ${CAMERA_RIGHT_DEFINITION} The viewer should see more of the right cheek, right jawline, and right ear than the left side of the face. Preserve identity, facial structure, hairstyle, skin tone, expression, posture, and clothing characteristics. Maintain a clean background and faithful lighting.`
      )
    },
    {
      key: 'side_profile',
      label: 'Side Profile',
      prompt: withStyleLock(
        'Generate a side-profile portrait of the same person. Preserve identity, facial structure, hairstyle, skin tone, expression, posture, and clothing characteristics. Maintain a clean background and faithful lighting.'
      )
    }
  ],
  universal: [
    {
      key: 'front_left_45',
      label: '45° Front Left',
      prompt: withStyleLock(
        `Generate the same subject, object, or entity from a 45-degree front-left perspective. ${CAMERA_LEFT_DEFINITION} Preserve identity and all defining visual characteristics, including shape, proportions, colors, textures, fur or material detail, and distinguishing marks. Do not introduce new objects, products, logos, text, packaging, accessories, or props. Maintain a clean background and high detail.`
      )
    },
    {
      key: 'front_right_45',
      label: '45° Front Right',
      prompt: withStyleLock(
        `Generate the same subject, object, or entity from a 45-degree front-right perspective. ${CAMERA_RIGHT_DEFINITION} Preserve identity and all defining visual characteristics, including shape, proportions, colors, textures, fur or material detail, and distinguishing marks. Do not introduce new objects, products, logos, text, packaging, accessories, or props. Maintain a clean background and high detail.`
      )
    },
    {
      key: 'back_view',
      label: 'Back View',
      prompt: withStyleLock(
        'Generate a centered rear-view image of the same subject, object, or entity. Preserve identity and all defining visual characteristics, including shape, proportions, colors, textures, fur or material detail, and distinguishing marks. Do not introduce new objects, products, logos, text, packaging, accessories, or props. Maintain a clean background and high detail.'
      )
    }
  ]
};

function getUniversalImageSize(sourceAspect?: SourceAspect): '9:16' | '1:1' {
  return sourceAspect === 'portrait' ? '9:16' : '1:1';
}

function getAspectRatio(assetType: AssetType, sourceAspect?: SourceAspect): '9:16' | '1:1' {
  if (assetType === 'avatar') return '9:16';
  if (assetType === 'product') return '1:1';
  return getUniversalImageSize(sourceAspect);
}

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
    const assetType = body?.assetType === 'avatar'
      ? 'avatar'
      : body?.assetType === 'product'
        ? 'product'
        : body?.assetType === 'universal'
          ? 'universal'
          : null;
    const sourceAspect = body?.sourceAspect === 'portrait' || body?.sourceAspect === 'square' || body?.sourceAspect === 'landscape'
      ? body.sourceAspect
      : undefined;
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
      return NextResponse.json({ error: 'assetType must be avatar, product, or universal' }, { status: 400 });
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
        const aspectRatio = getAspectRatio(assetType, sourceAspect);
        const createTaskResponse = await fetchWithRetry(KIE_CREATE_TASK_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.KIE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: AI_REFERENCE_MODEL,
            input: {
              prompt: preset.prompt,
              image_input: [sourceImageUrl],
              aspect_ratio: aspectRatio,
              resolution: AI_REFERENCE_RESOLUTION,
              output_format: AI_REFERENCE_OUTPUT_FORMAT
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
