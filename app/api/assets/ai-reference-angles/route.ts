import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import type { AiReferenceAngleAssetType, AiReferenceAngleJobStatus } from '@/lib/ai-reference-angle-jobs';
import { createKieGptImageTask } from '@/lib/kie-image-generation';
import { createJob, getJobsByIdsAndUser } from '@/lib/ai-reference-angle-store';

const KIE_UPLOAD_ENDPOINT = 'https://kieai.redpandaai.co/api/file-base64-upload';

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
  'Stand at the left side of the subject, facing diagonally toward the front-right corner. The image must show the left side plane and left face of the subject prominently. Do not return a near-frontal view, and do not mirror and produce the right-side view.';

const CAMERA_RIGHT_DEFINITION =
  'Stand at the right side of the subject, facing diagonally toward the front-left corner. The image must show the right side plane and right face of the subject prominently. Do not return a near-frontal view, and do not mirror and produce the left-side view.';

const ANGLE_PRESETS: Record<AiReferenceAngleAssetType, AnglePreset[]> = {
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

function getAspectRatio(assetType: AiReferenceAngleAssetType, sourceAspect?: SourceAspect): '9:16' | '1:1' {
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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'KIE API key not configured' }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({
        error: 'Webhook URL not configured. Please contact support.',
        details: 'NEXT_PUBLIC_SITE_URL environment variable is required for AI reference angle generation.'
      }, { status: 500 });
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

    if (maxGeneratableCount <= 0) {
      return NextResponse.json({ error: 'Reference images are already full (3/3).' }, { status: 400 });
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

    const presets = ANGLE_PRESETS[assetType].slice(existingReferenceCount, existingReferenceCount + count);
    const callBackUrl = `${siteUrl}/api/assets/ai-reference-angles/webhooks`;
    const jobsPayload: Array<{
      user_id: string;
      asset_type: AiReferenceAngleAssetType;
      source_image_url: string;
      preset_key: string;
      preset_label: string;
      kie_task_id: string;
      status: AiReferenceAngleJobStatus;
      aspect_ratio: string;
    }> = [];

    for (const preset of presets) {
      const aspectRatio = getAspectRatio(assetType, sourceAspect);
      const taskId = await createKieGptImageTask({
        prompt: preset.prompt,
        referenceImageUrls: [sourceImageUrl],
        aspectRatio,
        callBackUrl,
        moderationExternalId: `user_${userId}:ai_reference_angles:${assetType}:${preset.key}`
      }, 3, 30000);

      jobsPayload.push({
        user_id: userId,
        asset_type: assetType,
        source_image_url: sourceImageUrl,
        preset_key: preset.key,
        preset_label: preset.label,
        kie_task_id: taskId,
        status: 'processing',
        aspect_ratio: aspectRatio
      });
    }

    const createdJobs = jobsPayload.map((payload) =>
      createJob({
        userId: payload.user_id,
        assetType: payload.asset_type,
        sourceImageUrl: payload.source_image_url,
        presetKey: payload.preset_key,
        presetLabel: payload.preset_label,
        kieTaskId: payload.kie_task_id,
        aspectRatio: payload.aspect_ratio,
      })
    );

    return NextResponse.json({
      success: true,
      jobs: createdJobs.map((job) => ({
        id: job.id,
        presetKey: job.preset_key,
        presetLabel: job.preset_label,
        status: job.status,
      })),
      sourceImageUrl,
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

    const { searchParams } = new URL(request.url);
    const jobIds = searchParams.getAll('jobId').filter(Boolean);
    if (!jobIds.length) {
      return NextResponse.json({ error: 'At least one jobId is required' }, { status: 400 });
    }

    const jobsList = getJobsByIdsAndUser(jobIds, userId);
    const orderedJobs = jobIds
      .map((jobId) => jobsList.find((job) => job.id === jobId))
      .filter(Boolean);

    return NextResponse.json({ success: true, jobs: orderedJobs });
  } catch (error) {
    console.error('[ai-reference-angles] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
