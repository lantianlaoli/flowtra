import {
  executeProjectAgentCanvasActions,
  type ProjectAgentCanvasAction,
} from '@/lib/project-agent/canvas-actions';
import type { ProjectAgentCanvasAssetRef, ProjectAgentCanvasState } from '@/lib/project-agent/canvas-state';
import type { ProjectAgentMotionCloneExecution } from '@/lib/project-agent/motion-clone-execution';

const toVideoAsset = (
  referenceVideo: NonNullable<ProjectAgentMotionCloneExecution['referenceVideo']>
): ProjectAgentCanvasAssetRef => ({
  id: referenceVideo.id,
  name: referenceVideo.description?.trim() || 'Reference video',
  imageUrl: referenceVideo.coverUrl || null,
  durationSeconds: referenceVideo.durationSeconds ?? null,
  sourceType: 'creator',
  videoUrl: referenceVideo.videoUrl || null,
  videoCdnUrl: referenceVideo.videoCdnUrl || null,
  analysisLanguage: referenceVideo.analysisLanguage || null,
});

const toAvatarAsset = (
  selectedAvatar: NonNullable<ProjectAgentMotionCloneExecution['selectedAvatar']>
): ProjectAgentCanvasAssetRef => ({
  id: selectedAvatar.id,
  name: selectedAvatar.name,
  imageUrl: selectedAvatar.photoUrl || null,
  photos: selectedAvatar.photoUrl ? [selectedAvatar.photoUrl] : [],
});

const toProductAsset = (
  selectedProduct: NonNullable<ProjectAgentMotionCloneExecution['selectedProduct']>
): ProjectAgentCanvasAssetRef => ({
  id: selectedProduct.id,
  name: selectedProduct.name,
  imageUrl: selectedProduct.photoUrl || null,
  photos: selectedProduct.photoUrl ? [selectedProduct.photoUrl] : [],
});

export const syncMotionCloneCanvasState = (
  canvas: ProjectAgentCanvasState,
  motionClone: ProjectAgentMotionCloneExecution | null | undefined
): ProjectAgentCanvasState => {
  if (!motionClone) return canvas;

  const actions: ProjectAgentCanvasAction[] = [];

  if (motionClone.referenceVideo?.id) {
    actions.push({
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_asset_node',
        alias: 'videoAsset',
        assetType: 'video',
        asset: toVideoAsset(motionClone.referenceVideo),
        reuseExisting: true,
      },
    });
  }

  if (motionClone.selectedAvatar?.id) {
    actions.push({
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_asset_node',
        alias: 'avatarAsset',
        assetType: 'avatar',
        asset: toAvatarAsset(motionClone.selectedAvatar),
        reuseExisting: true,
      },
    });
  }

  if (motionClone.selectedProduct?.id) {
    actions.push({
      kind: 'canvas_mutation',
      mutation: {
        type: 'add_asset_node',
        alias: 'productAsset',
        assetType: 'product',
        asset: toProductAsset(motionClone.selectedProduct),
        reuseExisting: true,
      },
    });
  }

  if (motionClone.referenceVideo?.id) {
    actions.push(
      {
        kind: 'canvas_mutation',
        mutation: {
          type: 'add_feature_node',
          alias: 'featureNode',
          featureType: 'motion_clone',
          reuseExisting: true,
          select: true,
          config: {
            language: motionClone.referenceVideo.analysisLanguage || 'en',
            videoQuality: motionClone.videoQuality || '720p',
          },
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
    );

    if (motionClone.selectedAvatar?.id) {
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

    if (motionClone.selectedProduct?.id) {
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
  }

  if (actions.length === 0) return canvas;

  return executeProjectAgentCanvasActions({
    canvas,
    actions,
  }).canvas;
};
