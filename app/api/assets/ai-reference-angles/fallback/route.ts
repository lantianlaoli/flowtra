import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { AiReferenceAngleAssetType } from '@/lib/ai-reference-angle-jobs';

const KIE_CREATE_TASK_ENDPOINT = 'https://api.kie.ai/api/v1/jobs/createTask';
const FALLBACK_MODEL = 'seedream/5-lite-image-to-image';

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

const ANGLE_PRESETS: Record<AiReferenceAngleAssetType, Array<{ key: string; label: string; prompt: string }>> = {
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
        error: 'Webhook URL not configured. Please contact support.'
      }, { status: 500 });
    }

    const body = await request.json();
    const jobId = typeof body?.jobId === 'string' ? body.jobId : '';

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch the job and ensure it belongs to the user and is still processing without a fallback.
    const { data: job, error: fetchError } = await supabase
      .from('ai_reference_angle_jobs')
      .select('id, user_id, asset_type, source_image_url, preset_key, preset_label, status, aspect_ratio, fallback_kie_task_id')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (job.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (job.status !== 'processing') {
      return NextResponse.json({ error: 'Job is not in processing state' }, { status: 400 });
    }

    if (job.fallback_kie_task_id) {
      return NextResponse.json({ error: 'Fallback already triggered' }, { status: 409 });
    }

    const assetType = job.asset_type as AiReferenceAngleAssetType;
    const preset = ANGLE_PRESETS[assetType].find((p: { key: string; label: string; prompt: string }) => p.key === job.preset_key);
    if (!preset) {
      return NextResponse.json({ error: 'Preset not found' }, { status: 500 });
    }

    const aspectRatio = job.aspect_ratio || '1:1';
    const callBackUrl = `${siteUrl}/api/assets/ai-reference-angles/webhooks`;

    const createTaskResponse = await fetchWithRetry(
      KIE_CREATE_TASK_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KIE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: FALLBACK_MODEL,
          callBackUrl,
          input: {
            prompt: preset.prompt,
            image_urls: [job.source_image_url],
            aspect_ratio: aspectRatio,
            quality: 'basic',
            nsfw_checker: true
          }
        })
      },
      3,
      30000
    );

    if (!createTaskResponse.ok) {
      const taskError = await createTaskResponse.text();
      throw new Error(`Failed to create fallback task: ${taskError}`);
    }

    const taskResult = await createTaskResponse.json();
    const taskId = taskResult?.data?.taskId as string | undefined;
    if (taskResult?.code !== 200 || !taskId) {
      throw new Error(taskResult?.msg || 'Failed to create fallback task');
    }

    // Atomically update the job only if fallback_kie_task_id is still null.
    const { error: updateError } = await supabase
      .from('ai_reference_angle_jobs')
      .update({
        fallback_kie_task_id: taskId,
        fallback_model: FALLBACK_MODEL,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .is('fallback_kie_task_id', null);

    if (updateError) {
      console.error('[ai-reference-angles-fallback] Failed to update job:', updateError);
      return NextResponse.json({ error: 'Failed to persist fallback task' }, { status: 500 });
    }

    return NextResponse.json({ success: true, fallbackTaskId: taskId });
  } catch (error) {
    console.error('[ai-reference-angles-fallback] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
