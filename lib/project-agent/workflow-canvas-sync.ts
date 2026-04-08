import {
  executeProjectAgentCanvasActions,
  type ProjectAgentCanvasAction,
} from '@/lib/project-agent/canvas-actions';
import type { ProjectAgentCanvasAssetRef, ProjectAgentCanvasState } from '@/lib/project-agent/canvas-state';
import { getPrimaryCloneSelection } from '@/lib/project-agent/clone-selection';
import { syncMotionCloneCanvasState } from '@/lib/project-agent/motion-clone-canvas';
import type { ProjectAgentMotionCloneExecution } from '@/lib/project-agent/motion-clone-execution';

type AvatarSelectionLike = {
  avatar?: { id: string; name: string; photoUrl?: string | null } | null;
  product?: { id: string; name: string; photoUrl?: string | null } | null;
} | null | undefined;

type AvatarDraftLike = {
  scriptSource?: string | null;
} | null | undefined;

type CloneReferenceVideoLike = {
  id: string;
  name?: string | null;
  sourceType?: 'creator' | 'reference_video';
  videoUrl?: string | null;
  cdnUrl?: string | null;
  analysisLanguage?: string | null;
} | null | undefined;

type CloneReplacementDraftLike = {
  selectedAvatars?: Array<{ id: string; name: string; photoUrl?: string | null }> | null;
  selectedAvatar?: { id: string; name: string; photoUrl?: string | null } | null;
  selectedProducts?: Array<{ id: string; name: string; photoUrl?: string | null }> | null;
  selectedProduct?: { id: string; name: string; photoUrl?: string | null } | null;
} | null | undefined;

const toAvatarAsset = (avatar: { id: string; name: string; photoUrl?: string | null }): ProjectAgentCanvasAssetRef => ({
  id: avatar.id,
  name: avatar.name,
  imageUrl: avatar.photoUrl || null,
  photos: avatar.photoUrl ? [avatar.photoUrl] : [],
});

const toProductAsset = (product: { id: string; name: string; photoUrl?: string | null }): ProjectAgentCanvasAssetRef => ({
  id: product.id,
  name: product.name,
  imageUrl: product.photoUrl || null,
  photos: product.photoUrl ? [product.photoUrl] : [],
});

const toCloneVideoAsset = (video: NonNullable<CloneReferenceVideoLike>): ProjectAgentCanvasAssetRef => ({
  id: video.id,
  name: video.name?.trim() || 'Reference video',
  sourceType: video.sourceType || 'creator',
  videoUrl: video.videoUrl || null,
  videoCdnUrl: video.cdnUrl || null,
  analysisLanguage: video.analysisLanguage || null,
});

export const syncAvatarAdsCanvasState = (
  canvas: ProjectAgentCanvasState,
  input: {
    avatarSelection?: AvatarSelectionLike;
    avatar?: { id: string; name: string; photoUrl?: string | null } | null;
    product?: { id: string; name: string; photoUrl?: string | null } | null;
    avatarDraft?: AvatarDraftLike;
  }
): ProjectAgentCanvasState => {
  const selectedAvatar = input.avatarSelection?.avatar ?? input.avatar ?? null;
  const selectedProduct = input.avatarSelection?.product ?? input.product ?? null;

  if (!selectedAvatar?.id) return canvas;

  const scriptContent = input.avatarDraft?.scriptSource?.trim()
    || (selectedProduct?.name
      ? `Introduce ${selectedProduct.name} in a short premium style.`
      : 'Create a concise premium avatar ad script.');

  const actions: ProjectAgentCanvasAction[] = [
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_asset_node',
        alias: 'avatarAsset',
        assetType: 'avatar',
        asset: toAvatarAsset(selectedAvatar),
        reuseExisting: true,
      },
    },
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_text_node',
        alias: 'scriptAsset',
        content: scriptContent,
        reuseExisting: true,
      },
    },
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_feature_node',
        alias: 'featureNode',
        featureType: 'avatar_ads',
        reuseExisting: true,
        select: true,
      },
    },
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'connect_nodes',
        source: { kind: 'alias', alias: 'avatarAsset' },
        target: { kind: 'alias', alias: 'featureNode' },
        targetHandle: 'avatar',
      },
    },
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'connect_nodes',
        source: { kind: 'alias', alias: 'scriptAsset' },
        target: { kind: 'alias', alias: 'featureNode' },
        targetHandle: 'text',
      },
    },
  ];

  if (selectedProduct?.id) {
    actions.splice(1, 0, {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_asset_node',
        alias: 'productAsset',
        assetType: 'product',
        asset: toProductAsset(selectedProduct),
        reuseExisting: true,
      },
    });
    actions.push({
      kind: 'canvas_mutation',
      mutation: {
        type: 'connect_nodes',
        source: { kind: 'alias', alias: 'productAsset' },
        target: { kind: 'alias', alias: 'featureNode' },
        targetHandle: 'product',
      },
    });
  }

  actions.push({
    kind: 'canvas_mutation',
    mutation: { type: 'format_layout' },
  });

  return executeProjectAgentCanvasActions({ canvas, actions }).canvas;
};

export const syncVideoCloneCanvasState = (
  canvas: ProjectAgentCanvasState,
  input: {
    cloneReferenceVideo?: CloneReferenceVideoLike;
    cloneReplacementDraft?: CloneReplacementDraftLike;
  }
): ProjectAgentCanvasState => {
  const referenceVideo = input.cloneReferenceVideo;
  if (!referenceVideo?.id) return canvas;

  const selectedAvatar = getPrimaryCloneSelection(
    input.cloneReplacementDraft?.selectedAvatars,
    input.cloneReplacementDraft?.selectedAvatar
  );
  const selectedProduct = getPrimaryCloneSelection(
    input.cloneReplacementDraft?.selectedProducts,
    input.cloneReplacementDraft?.selectedProduct
  );

  const actions: ProjectAgentCanvasAction[] = [
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_asset_node',
        alias: 'videoAsset',
        assetType: 'video',
        asset: toCloneVideoAsset(referenceVideo),
        reuseExisting: true,
      },
    },
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_feature_node',
        alias: 'featureNode',
        featureType: 'video_clone',
        reuseExisting: true,
        select: true,
      },
    },
    {
      kind: 'canvas_mutation',
      mutation: {
        type: 'connect_nodes',
        source: { kind: 'alias', alias: 'videoAsset' },
        target: { kind: 'alias', alias: 'featureNode' },
        targetHandle: 'video',
      },
    },
  ];

  if (selectedProduct?.id) {
    actions.splice(1, 0, {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_asset_node',
        alias: 'productAsset',
        assetType: 'product',
        asset: toProductAsset(selectedProduct),
        reuseExisting: true,
      },
    });
    actions.push({
      kind: 'canvas_mutation',
      mutation: {
        type: 'connect_nodes',
        source: { kind: 'alias', alias: 'productAsset' },
        target: { kind: 'alias', alias: 'featureNode' },
        targetHandle: 'product',
      },
    });
  } else if (selectedAvatar?.id) {
    actions.splice(1, 0, {
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_asset_node',
        alias: 'avatarAsset',
        assetType: 'avatar',
        asset: toAvatarAsset(selectedAvatar),
        reuseExisting: true,
      },
    });
    actions.push({
      kind: 'canvas_mutation',
      mutation: {
        type: 'connect_nodes',
        source: { kind: 'alias', alias: 'avatarAsset' },
        target: { kind: 'alias', alias: 'featureNode' },
        targetHandle: 'avatar',
      },
    });
  }

  actions.push({
    kind: 'canvas_mutation',
    mutation: { type: 'format_layout' },
  });

  return executeProjectAgentCanvasActions({ canvas, actions }).canvas;
};

export const syncProjectAgentWorkflowCanvasState = (
  canvas: ProjectAgentCanvasState,
  input: {
    motionClone?: ProjectAgentMotionCloneExecution | null;
    avatarSelection?: AvatarSelectionLike;
    avatar?: { id: string; name: string; photoUrl?: string | null } | null;
    product?: { id: string; name: string; photoUrl?: string | null } | null;
    avatarDraft?: AvatarDraftLike;
    cloneReferenceVideo?: CloneReferenceVideoLike;
    cloneReplacementDraft?: CloneReplacementDraftLike;
  }
): ProjectAgentCanvasState => {
  let nextCanvas = canvas;
  nextCanvas = syncMotionCloneCanvasState(nextCanvas, input.motionClone);
  nextCanvas = syncAvatarAdsCanvasState(nextCanvas, input);
  nextCanvas = syncVideoCloneCanvasState(nextCanvas, input);
  return nextCanvas;
};
