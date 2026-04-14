import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildManualCloneSeedPrompts,
  resolveCloneModeFromProject
} from '@/lib/video-clone-workflow';

test('resolves clone mode from selected_inputs for competitor ad projects', () => {
  const resolved = resolveCloneModeFromProject({
    selected_inputs: {
      referenceSourceType: 'reference_video',
      referenceSourceMediaType: 'video',
      referenceSourceId: 'comp_123',
      isCloneMode: true
    }
  });

  assert.deepEqual(resolved, {
    isCloneMode: true,
    sourceType: 'reference_video',
    mediaType: 'video',
    sourceId: 'comp_123'
  });
});

test('resolves clone mode from selected_inputs for creator source video projects', () => {
  const resolved = resolveCloneModeFromProject({
    selected_inputs: {
      referenceSourceType: 'creator_source_video',
      referenceSourceMediaType: 'video',
      referenceSourceId: 'csv_123',
      isCloneMode: true
    }
  });

  assert.deepEqual(resolved, {
    isCloneMode: true,
    sourceType: 'creator_source_video',
    mediaType: 'video',
    sourceId: 'csv_123'
  });
});

test('falls back to legacy reference_video_id when metadata is missing', () => {
  const resolved = resolveCloneModeFromProject({
    reference_video_id: 'legacy_competitor'
  });

  assert.deepEqual(resolved, {
    isCloneMode: true,
    sourceType: 'reference_video',
    mediaType: 'video',
    sourceId: 'legacy_competitor'
  });
});

test('returns non-clone mode when no metadata or legacy source exists', () => {
  const resolved = resolveCloneModeFromProject({
    selected_inputs: {
      isCloneMode: false
    }
  });

  assert.deepEqual(resolved, {
    isCloneMode: false,
    sourceType: null,
    mediaType: null,
    sourceId: null
  });
});

test('buildManualCloneSeedPrompts preserves reference shots for segmented non-Kling clone projects', () => {
  const prompts = buildManualCloneSeedPrompts({
    videoModel: 'seedance_2_fast',
    segmentCount: 2,
    videoDuration: '16',
    language: 'en',
    referenceVideoShots: [
      {
        id: 1,
        startTime: '00:00',
        endTime: '00:08',
        durationSeconds: 8,
        firstFrameDescription: 'Shot one opening frame with product on table.',
        subject: 'Creator and product',
        contextEnvironment: 'Minimal apartment desk',
        action: 'Creator picks up the product',
        style: 'UGC lifestyle',
        cameraMotionPositioning: 'Static close-up',
        composition: 'Tight crop',
        ambianceColourLighting: 'Warm morning light',
        audio: 'Soft beat',
        dialogue: 'This is the one I actually keep on my desk.',
        sfx: 'Soft package tap',
        ambient: 'Low room tone',
        startTimeSeconds: 0,
        endTimeSeconds: 8
      },
      {
        id: 2,
        startTime: '00:08',
        endTime: '00:16',
        durationSeconds: 8,
        firstFrameDescription: 'Shot two opening frame with product in use.',
        subject: 'Creator using product',
        contextEnvironment: 'Bedroom mirror area',
        action: 'Creator demonstrates the result',
        style: 'UGC testimonial',
        cameraMotionPositioning: 'Handheld medium shot',
        composition: 'Vertical waist-up',
        ambianceColourLighting: 'Neutral indoor light',
        audio: 'Voiceover line',
        dialogue: 'You can see the finish right away.',
        sfx: '',
        ambient: 'Quiet bedroom ambience',
        startTimeSeconds: 8,
        endTimeSeconds: 16
      }
    ]
  });

  assert.equal(prompts.length, 2);
  assert.equal(prompts[0].first_frame_description, 'Shot one opening frame with product on table.');
  assert.equal(prompts[0].shots?.[0].action, 'Creator picks up the product');
  assert.equal(prompts[0].shots?.[0].dialogue, 'This is the one I actually keep on my desk.');
  assert.equal(prompts[0].shots?.[0].sfx, 'Soft package tap');
  assert.equal(prompts[0].shots?.[0].ambient, 'Low room tone');
  assert.equal(prompts[1].first_frame_description, 'Shot two opening frame with product in use.');
  assert.equal(prompts[1].shots?.[0].composition, 'Vertical waist-up');
  assert.equal(prompts[1].shots?.[0].dialogue, 'You can see the finish right away.');
});

test('buildManualCloneSeedPrompts creates shot-aware Kling segments without AI adaptation', () => {
  const prompts = buildManualCloneSeedPrompts({
    videoModel: 'kling_3',
    segmentCount: 1,
    videoDuration: '12',
    language: 'en',
    referenceTotalDurationSeconds: 12,
    referenceVideoShots: [
      {
        id: 1,
        startTime: '00:00',
        endTime: '00:04',
        durationSeconds: 4,
        firstFrameDescription: 'Opening frame with product hero shot.',
        subject: 'Product close-up',
        contextEnvironment: 'Bedroom background',
        action: 'Hand presents the device',
        style: 'Product demo',
        cameraMotionPositioning: 'Locked close-up',
        composition: 'Macro angle',
        ambianceColourLighting: 'Soft warm light',
        audio: 'Music only',
        dialogue: 'Watch the texture hit right away.',
        sfx: 'Soft click',
        ambient: 'Bedroom room tone',
        startTimeSeconds: 0,
        endTimeSeconds: 4
      },
      {
        id: 2,
        startTime: '00:04',
        endTime: '00:08',
        durationSeconds: 4,
        firstFrameDescription: 'Mid shot of product rotating.',
        subject: 'Product in hand',
        contextEnvironment: 'Bedroom background',
        action: 'Hand rotates the device',
        style: 'Product demo',
        cameraMotionPositioning: 'Slow follow movement',
        composition: 'Medium close-up',
        ambianceColourLighting: 'Warm LED accent',
        audio: 'Music continues',
        dialogue: 'Then turn it so the detail catches.',
        sfx: '',
        ambient: 'Music bed',
        startTimeSeconds: 4,
        endTimeSeconds: 8
      },
      {
        id: 3,
        startTime: '00:08',
        endTime: '00:12',
        durationSeconds: 4,
        firstFrameDescription: 'Final use-case shot on leg.',
        subject: 'Product on lower leg',
        contextEnvironment: 'Bedroom bed setup',
        action: 'Device glides along calf muscle',
        style: 'UGC demo',
        cameraMotionPositioning: 'Following close-up',
        composition: 'Vertical close-up',
        ambianceColourLighting: 'Indoor ambient glow',
        audio: 'Music and CTA overlay',
        dialogue: 'Finish on the hero result.',
        sfx: 'Soft fabric glide',
        ambient: 'Room tone with music',
        startTimeSeconds: 8,
        endTimeSeconds: 12
      }
    ]
  });

  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].shots?.length, 3);
  assert.equal(prompts[0].shots?.[0].action, 'Hand presents the device');
  assert.equal(prompts[0].shots?.[0].dialogue, 'Watch the texture hit right away.');
  assert.equal(prompts[0].shots?.[0].sfx, 'Soft click');
  assert.equal(prompts[0].shots?.[2].action, 'Device glides along calf muscle');
  assert.equal(prompts[0].shots?.[2].ambient, 'Room tone with music');
  assert.equal(prompts[0].is_continuation_from_prev, false);
});
