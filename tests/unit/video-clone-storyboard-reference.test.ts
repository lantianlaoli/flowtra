import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getDashboardDirectReferenceRequestOptions,
  getDashboardVideoCloneDuration,
} from '@/lib/video-clone-direct-reference';
import {
  getProjectAgentCloneExecutionMode,
  getProjectAgentCloneGenerationCost,
} from '@/lib/video-clone-billing';
import {
  buildVideoCloneStartPayload,
  normalizeCloneExecutionStatus,
} from '@/lib/project-agent/node-execution';
import {
  buildSeedanceStoryboardClonePlan,
  __test__ as videoCloneWorkflowTest,
} from '@/lib/video-clone-workflow';
import type { ReferenceVideoShot } from '@/lib/reference-video-shots';

const buildShot = (id: number, start: number, duration: number): ReferenceVideoShot => ({
  id,
  startTime: `00:${String(start).padStart(2, '0')}`,
  endTime: `00:${String(start + duration).padStart(2, '0')}`,
  durationSeconds: duration,
  firstFrameDescription: `Shot ${id} first frame`,
  subject: `Original subject ${id}`,
  contextEnvironment: `Reference environment ${id}`,
  action: `Reference action ${id}`,
  style: 'Clean commercial realism',
  cameraMotionPositioning: 'Smooth lateral tracking camera',
  composition: 'Centered product hero composition',
  ambianceColourLighting: 'Soft studio lighting',
  audio: 'Upbeat BGM and natural SFX',
  dialogue: '',
  startTimeSeconds: start,
  endTimeSeconds: start + duration,
});

const assets = {
  selectedAvatarId: 'avatar-1',
  selectedProductId: null,
  selectedPetId: null,
  selectedAvatarIds: ['avatar-1'],
  selectedProductIds: [],
  selectedPetIds: [],
  avatarPhotoUrls: ['https://example.com/avatar.png'],
  productImageUrls: [],
  petPhotoUrls: [],
  avatarName: 'Replacement Creator',
  productName: null,
  petName: null,
};

test('Project Agent Seedance clone requests resolve to storyboard mode', () => {
  assert.equal(
    getProjectAgentCloneExecutionMode({
      model: 'seedance_2_mini',
      durationSeconds: 14,
      hasReferenceVideoUrl: true,
    }),
    'clone_storyboard_reference'
  );

  assert.equal(
    getProjectAgentCloneExecutionMode({
      model: 'seedance_2_fast',
      durationSeconds: 72,
      hasReferenceVideoUrl: false,
    }),
    'clone_storyboard_reference'
  );
});

test('Project Agent clone payload prefers actual media duration over stale asset duration', () => {
  const payload = buildVideoCloneStartPayload({
    avatar: {
      id: 'avatar-1',
      name: 'Avatar',
      imageUrl: 'https://example.com/avatar.png',
    },
    video: {
      id: 'video-1',
      name: 'Reference',
      durationSeconds: 21,
      mediaDurationSeconds: 14.267,
      videoUrl: 'https://example.com/reference.mp4',
      videoCdnUrl: null,
    },
    config: {
      videoModel: 'seedance_2_mini',
      videoQuality: '480p',
      videoQualityManual: true,
      aspectRatio: '9:16',
    },
  });

  assert.equal(payload.executionMode, 'clone_storyboard_reference');
  assert.equal(payload.videoDuration, '15');
  assert.equal(payload.referenceSourceMediaDurationSeconds, 14.267);
});

test('dashboard Seedance clone options no longer select direct reference mode', () => {
  const options = getDashboardDirectReferenceRequestOptions({
    model: 'seedance_2_mini',
    durationSeconds: 14,
    videoUrl: '',
    videoCdnUrl: 'https://example.com/reference.mp4',
  });

  assert.deepEqual(options, {
    requestSource: 'project_agent_clone',
    executionMode: 'clone_storyboard_reference',
    referenceSourceVideoUrl: 'https://example.com/reference.mp4',
    videoDuration: '14',
  });
});

test('storyboard clone preserves exact 14s duration and packs long references into 4-15s tasks', () => {
  const duration = getDashboardVideoCloneDuration({
    model: 'seedance_2_mini',
    referenceDurationSeconds: 14,
    defaultDuration: '8',
    directReferenceOptions: {
      requestSource: 'project_agent_clone',
      executionMode: 'clone_storyboard_reference',
      referenceSourceVideoUrl: 'https://example.com/reference.mp4',
      videoDuration: '14',
    },
  });
  assert.equal(duration, '14');

  const plan38 = buildSeedanceStoryboardClonePlan({
    shots: [buildShot(1, 0, 10), buildShot(2, 10, 14), buildShot(3, 24, 14)],
    fallbackDurationSeconds: 38,
    aspectRatio: '9:16',
    language: 'en',
    assets,
  });
  assert.ok(plan38.segments.length > 1);
  assert.ok(plan38.segments.every((segment) => {
    const durationSeconds = segment.shots?.reduce((sum, shot) => sum + (shot.duration_seconds || 0), 0) || 0;
    return durationSeconds >= 4 && durationSeconds <= 15;
  }));

  const plan72 = buildSeedanceStoryboardClonePlan({
    shots: [buildShot(1, 0, 18), buildShot(2, 18, 18), buildShot(3, 36, 18), buildShot(4, 54, 18)],
    fallbackDurationSeconds: 72,
    aspectRatio: '9:16',
    language: 'en',
    assets,
  });
  assert.ok(plan72.segments.length >= 5);
  assert.ok(plan72.segments.every((segment) => {
    const durationSeconds = segment.shots?.reduce((sum, shot) => sum + (shot.duration_seconds || 0), 0) || 0;
    return durationSeconds >= 4 && durationSeconds <= 15;
  }));
});

test('storyboard clone keeps short multi-cut references as one Seedance task with one row per cut', () => {
  const plan = buildSeedanceStoryboardClonePlan({
    shots: [buildShot(1, 0, 8), buildShot(2, 8, 6)],
    fallbackDurationSeconds: 14,
    aspectRatio: '9:16',
    language: 'en',
    assets,
  });

  assert.equal(plan.segments.length, 1);
  assert.equal(plan.durationSeconds, 14);
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.segments[0].shots?.length, 2);
  assert.equal(plan.rows[0].source_time_range, '00:00 - 00:08');
  assert.equal(plan.rows[1].source_time_range, '00:08 - 00:14');
});

test('storyboard clone trusts actual playable media duration over stale analysis duration', () => {
  const plan = buildSeedanceStoryboardClonePlan({
    shots: [
      buildShot(1, 0, 4),
      buildShot(2, 4, 4),
      buildShot(3, 8, 3),
      buildShot(4, 11, 4),
      buildShot(5, 15, 3),
      buildShot(6, 18, 3),
    ],
    fallbackDurationSeconds: 21,
    sourceMediaDurationSeconds: 14.267,
    aspectRatio: '9:16',
    language: 'en',
    assets,
  });

  assert.equal(plan.segments.length, 1);
  assert.equal(plan.durationSeconds, 15);
  assert.equal(plan.rows.length, 6);
  const segmentDuration = plan.segments[0].shots?.reduce((sum, shot) => sum + (shot.duration_seconds || 0), 0) || 0;
  assert.equal(segmentDuration, 15);
});

test('storyboard clone billing uses no-video-input pricing for Seedance 2 Mini 480p', () => {
  const cost = getProjectAgentCloneGenerationCost({
    model: 'seedance_2_mini',
    durationSeconds: 14.267,
    videoQuality: '480p',
    executionMode: 'clone_storyboard_reference',
    hasReferenceVideoUrl: true,
  });

  assert.equal(cost, 143);
});

test('storyboard clone keeps single short source shot as a single row', () => {
  const plan = buildSeedanceStoryboardClonePlan({
    shots: [buildShot(1, 0, 12)],
    fallbackDurationSeconds: 12,
    aspectRatio: '9:16',
    language: 'en',
    assets,
  });

  assert.equal(plan.segments.length, 1);
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].source_time_range, '00:00 - 00:12');
});

test('storyboard Seedance request uses only the storyboard image as a reference', () => {
  const referenceImages = videoCloneWorkflowTest.getProjectAgentSeedanceReferenceImageUrls({
    video_model: 'seedance_2_mini',
    selected_inputs: {
      workflowSource: 'project_agent_clone',
      executionMode: 'clone_storyboard_reference',
    },
    video_prompts: {
      storyboard_mode: {
        storyboard_image_url: 'https://example.com/storyboard.png',
      },
      clone_reference_assets: {
        avatarPhotoUrls: ['https://example.com/avatar.png'],
        productImageUrls: ['https://example.com/product.png'],
        petPhotoUrls: ['https://example.com/pet.png'],
      },
    },
  });

  assert.deepEqual(referenceImages, ['https://example.com/storyboard.png']);

  const requestBody = videoCloneWorkflowTest.buildSeedanceVideoRequestBody({
    projectId: 'project-1',
    segmentIndex: 0,
    model: 'seedance_2_mini',
    prompt: 'Follow storyboard row 1 exactly.',
    inputUrls: [],
    referenceImageUrls: referenceImages,
    firstFrameUrl: 'https://example.com/first.png',
    lastFrameUrl: 'https://example.com/last.png',
    useFirstLastFrameFields: false,
    aspectRatio: '9:16',
    resolution: '720p',
    duration: 14,
  }) as { input: Record<string, unknown> };

  assert.deepEqual(requestBody.input.reference_image_urls, [
    'https://example.com/storyboard.png',
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(requestBody.input, 'first_frame_url'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(requestBody.input, 'last_frame_url'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(requestBody.input, 'reference_video_urls'), false);
});

test('storyboard sheet prompt enforces TikTok UGC photorealism', () => {
  const plan = buildSeedanceStoryboardClonePlan({
    shots: [buildShot(1, 0, 8), buildShot(2, 8, 6)],
    fallbackDurationSeconds: 14,
    aspectRatio: '9:16',
    language: 'en',
    assets,
  });
  const prompt = videoCloneWorkflowTest.buildStoryboardSheetPrompt({
    rows: plan.rows,
    aspectRatio: '9:16',
    assets,
  });

  assert.match(prompt, /TikTok UGC/);
  assert.match(prompt, /NOT anime/);
  assert.match(prompt, /phone-camera/);
  assert.match(prompt, /full visible appearance/);
  assert.match(prompt, /wardrobe/);
  assert.match(prompt, /Rhythm lock/);
  assert.doesNotMatch(prompt, /cinematic drawn panels/);
  assert.doesNotMatch(prompt, /polished professional storyboard sheet/);
});

test('replacement summary locks identity to avatar/product/pet reference photos', () => {
  const summary = videoCloneWorkflowTest.buildReplacementSummary({
    ...assets,
    avatarName: 'Replacement Creator',
    petName: 'Mochi',
  });

  assert.match(summary, /gender presentation/);
  assert.match(summary, /clothing color/);
  assert.match(summary, /clothing fabric/);
  assert.match(summary, /body proportions/);
  assert.match(summary, /hair color/);
  assert.match(summary, /skin tone/);
  assert.match(summary, /facial structure/);
  assert.match(summary, /breed/);

  const plan = buildSeedanceStoryboardClonePlan({
    shots: [buildShot(1, 0, 8)],
    fallbackDurationSeconds: 8,
    aspectRatio: '9:16',
    language: 'en',
    assets,
  });

  assert.match(plan.rows[0].replacement_notes, /Lock identity to the connected reference photos/);
  assert.match(plan.rows[0].replacement_notes, /full visible appearance and clothing/);
  assert.match(plan.rows[0].replacement_notes, /camera rhythm/);
  assert.match(plan.rows[0].storyboard_panel_prompt, /Identity lock/);
  assert.match(plan.rows[0].storyboard_panel_prompt, /Full appearance lock/);
  assert.match(plan.segments[0].subject, /full visible outfit/);
});

test('Project Agent storyboard milestones skip scene-frame generation', () => {
  const status = normalizeCloneExecutionStatus({
    status: 'processing',
    current_step: 'generating_storyboard_image',
    progress_percentage: 25,
    data: {
      projectId: 'project-1',
      executionMode: 'clone_storyboard_reference',
      workflowSource: 'project_agent_clone',
      videoGenerationRequested: true,
      segments: [],
    },
  });

  assert.equal(status.currentMilestoneKey, 'generating_storyboard');
  assert.deepEqual(
    status.milestones.map((milestone) => milestone.label),
    ['Generating storyboard', 'Generating video', 'Merging video', 'Completed']
  );
});
