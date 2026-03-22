import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  buildAvatarAdsStartPayload,
  buildMotionCloneStartPayload,
  buildVideoCloneStartPayload,
  normalizeExecutionStatus,
  type ProjectAgentConnectedFeatureInputs,
} from '@/lib/project-agent/node-execution';
import type {
  ProjectAgentCanvasAssetRef,
  ProjectAgentFeatureNodeConfig,
  ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';
import { signInternalUserRequest } from '@/lib/security/internal-request';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CanvasRunRequestBody = {
  nodeType?: ProjectAgentFeatureNodeType;
  mode?: 'start' | 'advance';
  projectId?: string | null;
  config?: ProjectAgentFeatureNodeConfig | null;
  connectedAssets?: ProjectAgentConnectedFeatureInputs | null;
};

const buildInternalHeaders = (userId: string) => {
  const timestamp = String(Date.now());
  return {
    'x-project-agent-internal': '1',
    'x-project-agent-user-id': userId,
    'x-project-agent-timestamp': timestamp,
    'x-project-agent-signature': signInternalUserRequest(userId, timestamp),
  };
};

const getOrigin = (request: NextRequest) => {
  const url = new URL(request.url);
  return url.origin;
};

const fetchJson = async (input: string, init?: RequestInit) => {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === 'string'
      ? payload.error
      : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload as Record<string, unknown>;
};

const toFormData = (payload: Record<string, string>) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.set(key, value);
  });
  return formData;
};

const ensureAsset = (
  value: ProjectAgentCanvasAssetRef | null | undefined,
  label: string
) => {
  if (!value?.id) {
    throw new Error(`${label} input is missing.`);
  }
  return value;
};

const fetchAvatarStatus = async (origin: string, projectId: string, headers?: HeadersInit) => {
  const payload = await fetchJson(`${origin}/api/avatar-ads/${projectId}/status`, {
    cache: 'no-store',
    headers,
  });
  return normalizeExecutionStatus('avatar_ads', payload);
};

const fetchCloneStatus = async (origin: string, projectId: string, headers?: HeadersInit) => {
  const payload = await fetchJson(`${origin}/api/competitor-ugc-replication/${projectId}/status`, {
    cache: 'no-store',
    headers,
  });
  return normalizeExecutionStatus('video_clone', payload);
};

const fetchMotionStatus = async (origin: string, projectId: string, headers?: HeadersInit) => {
  const payload = await fetchJson(`${origin}/api/motion-clone/${projectId}/status`, {
    cache: 'no-store',
    headers,
  });
  return normalizeExecutionStatus('motion_clone', payload);
};

const startAvatarAds = async (origin: string, userId: string, body: CanvasRunRequestBody) => {
  const avatar = ensureAsset(body.connectedAssets?.avatar, 'Avatar');
  const product = ensureAsset(body.connectedAssets?.product, 'Product');
  const payload = buildAvatarAdsStartPayload({
    avatar,
    product,
    config: body.config,
  });

  const internalHeaders = buildInternalHeaders(userId);
  const createPayload = await fetchJson(`${origin}/api/avatar-ads/create`, {
    method: 'POST',
    headers: internalHeaders,
    body: toFormData({
      user_id: userId,
      selected_person_photo_url: payload.selectedPersonPhotoUrl,
      selected_product_id: payload.selectedProductId,
      video_duration_seconds: String(payload.videoDurationSeconds),
      video_aspect_ratio: payload.videoAspectRatio,
      language: payload.language,
      video_model: payload.videoModel,
    }),
  });

  const projectId = typeof createPayload.id === 'string' ? createPayload.id : null;
  if (!projectId) {
    throw new Error('Avatar Ads project was created without an id.');
  }

  let status = await fetchAvatarStatus(origin, projectId, internalHeaders);
  if (status.nextAction === 'confirm_avatar') {
    const statusPayload = await fetchJson(`${origin}/api/avatar-ads/${projectId}/status`, {
      cache: 'no-store',
      headers: internalHeaders,
    });
    const project = statusPayload.project as Record<string, unknown> | undefined;
    const totalDuration = typeof project?.video_duration_seconds === 'number'
      ? project.video_duration_seconds
      : Number(body.config?.videoDuration || '16');

    await fetchJson(`${origin}/api/avatar-ads/${projectId}/confirm`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({
        updatedPrompts: project?.generated_prompts || null,
        totalDurationSeconds: totalDuration,
      }),
    });
    status = await fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  return status;
};

const startVideoClone = async (origin: string, userId: string, body: CanvasRunRequestBody) => {
  const avatar = ensureAsset(body.connectedAssets?.avatar, 'Avatar');
  const product = ensureAsset(body.connectedAssets?.product, 'Product');
  const video = ensureAsset(body.connectedAssets?.video, 'Video');
  const payload = buildVideoCloneStartPayload({
    avatar,
    product,
    video,
    config: body.config,
  });

  const internalHeaders = buildInternalHeaders(userId);
  const createPayload = await fetchJson(`${origin}/api/competitor-ugc-replication/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...internalHeaders,
    },
    body: JSON.stringify({
      ...payload,
      userId,
    }),
  });

  const projectId = typeof createPayload.projectId === 'string'
    ? createPayload.projectId
    : typeof createPayload.historyId === 'string'
      ? createPayload.historyId
      : null;

  if (!projectId) {
    throw new Error('Video Clone project was created without an id.');
  }

  return fetchCloneStatus(origin, projectId, internalHeaders);
};

export const startMotionClone = async (origin: string, userId: string, body: CanvasRunRequestBody) => {
  const avatar = ensureAsset(body.connectedAssets?.avatar, 'Avatar');
  const product = ensureAsset(body.connectedAssets?.product, 'Product');
  const video = ensureAsset(body.connectedAssets?.video, 'Video');
  if (video.sourceType === 'competitor_ad') {
    throw new Error('Motion Clone requires a creator video, not a competitor ad.');
  }

  const internalHeaders = buildInternalHeaders(userId);
  const createPayload = await fetchJson(`${origin}/api/motion-clone/create`, {
    method: 'POST',
    headers: internalHeaders,
  });
  const project = createPayload.project as Record<string, unknown> | undefined;
  const projectId = typeof project?.id === 'string' ? project.id : null;
  if (!projectId) {
    throw new Error('Motion Clone project was created without an id.');
  }

  const payload = buildMotionCloneStartPayload({
    avatar,
    product,
    video,
    config: body.config,
  });

  await fetchJson(`${origin}/api/motion-clone/${projectId}/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...internalHeaders,
    },
    body: JSON.stringify({
      reference_video_id: payload.referenceVideoId,
      avatar_id: payload.avatarId,
      product_id: payload.productId,
      action: payload.action,
      mode: payload.mode,
    }),
  });

  return fetchMotionStatus(origin, projectId, internalHeaders);
};

const advanceVideoClone = async (origin: string, userId: string, projectId: string) => {
  const internalHeaders = buildInternalHeaders(userId);
  let status = await fetchCloneStatus(origin, projectId, internalHeaders);
  if (status.nextAction === 'start_clone_video') {
    await fetchJson(`${origin}/api/competitor-ugc-replication/${projectId}/start-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({}),
    });
    status = await fetchCloneStatus(origin, projectId, internalHeaders);
  }

  if (status.nextAction === 'merge_clone_video') {
    await fetchJson(`${origin}/api/competitor-ugc-replication/${projectId}/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({}),
    });
    status = await fetchCloneStatus(origin, projectId, internalHeaders);
  }

  return status;
};

const advanceAvatarAds = async (origin: string, userId: string, projectId: string) => {
  const internalHeaders = buildInternalHeaders(userId);
  const payload = await fetchJson(`${origin}/api/avatar-ads/${projectId}/status`, {
    cache: 'no-store',
    headers: internalHeaders,
  });
  const project = payload.project as Record<string, unknown> | undefined;
  const status = normalizeExecutionStatus('avatar_ads', payload);

  if (status.nextAction === 'confirm_avatar') {
    await fetchJson(`${origin}/api/avatar-ads/${projectId}/confirm`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...internalHeaders,
      },
      body: JSON.stringify({
        updatedPrompts: project?.generated_prompts || null,
        totalDurationSeconds: project?.video_duration_seconds || 16,
      }),
    });
    return fetchAvatarStatus(origin, projectId, internalHeaders);
  }

  return status;
};

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CanvasRunRequestBody;
    const origin = getOrigin(request);
    const nodeType = body.nodeType;

    if (!nodeType) {
      return NextResponse.json({ error: 'nodeType is required' }, { status: 400 });
    }

    if (body.mode === 'advance') {
      if (!body.projectId) {
        return NextResponse.json({ error: 'projectId is required for advance' }, { status: 400 });
      }

      const advancedStatus = nodeType === 'avatar_ads'
        ? await advanceAvatarAds(origin, userId, body.projectId)
        : nodeType === 'video_clone'
          ? await advanceVideoClone(origin, userId, body.projectId)
          : await fetchMotionStatus(origin, body.projectId, buildInternalHeaders(userId));

      return NextResponse.json({ success: true, execution: advancedStatus });
    }

    const execution = nodeType === 'avatar_ads'
      ? await startAvatarAds(origin, userId, body)
      : nodeType === 'video_clone'
        ? await startVideoClone(origin, userId, body)
        : await startMotionClone(origin, userId, body);

    return NextResponse.json({ success: true, execution });
  } catch (error) {
    console.error('[Project Agent Canvas Run] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
