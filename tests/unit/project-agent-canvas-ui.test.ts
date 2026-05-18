import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProjectAgentCanvasNotice,
  getFeatureStartActionTitle,
  getPendingConnectionPathTarget,
  getProjectAgentFeaturePlaceholderCopy,
  shouldShowFeatureEstimatedCredits,
} from '@/lib/project-agent/canvas-ui';
import {
  applySupplementalTextToSegments,
  buildSupplementalTextPromptInstruction,
} from '@/lib/video-clone-workflow';

test('video clone ready copy mentions optional product guidance', () => {
  const copy = getProjectAgentFeaturePlaceholderCopy({
    featureType: 'video_clone',
    blockedReason: null,
    missingInputs: [],
  });

  assert.equal(copy, 'Ready to start. Optionally connect Product Guidance for product behavior details.');
});

test('canvas notice helper normalizes warning payloads', () => {
  const notice = createProjectAgentCanvasNotice('  Add a compatible feature node before connecting this text.  ', 42);

  assert.deepEqual(notice, {
    id: 42,
    message: 'Add a compatible feature node before connecting this text.',
    severity: 'warning',
    source: 'canvas',
  });
});

test('supplemental text prompt instruction is treated as high-priority guidance', () => {
  const instruction = buildSupplementalTextPromptInstruction(
    'Bubbles should emerge from the front nozzle after the motor starts.',
  );

  assert.match(instruction, /HIGH-PRIORITY SUPPLEMENTAL PRODUCT BEHAVIOR GUIDANCE:/);
  assert.match(instruction, /front nozzle/);
  assert.match(instruction, /strong constraint/i);
});

test('supplemental text is force-applied to generated segment prompts', () => {
  const [segment] = applySupplementalTextToSegments(
    [
      {
        index: 1,
        audio: 'Ambient backyard sounds',
        style: 'Handheld',
        action: 'Toddler reaches toward the bubble machine',
        subject: 'Toddler and bubble machine',
        composition: 'Child in foreground, machine in background',
        context_environment: 'Nighttime backyard',
        first_frame_description: 'A toddler runs toward a bubble machine in a dark backyard.',
        ambiance_colour_lighting: 'Playful and warm',
        camera_motion_positioning: 'Medium tracking shot',
        dialogue: '',
        language: 'en',
        shots: [
          {
            id: 1,
            time_range: '00:00 - 00:03',
            audio: 'Ambient backyard sounds',
            style: 'Handheld',
            action: 'Toddler reaches toward the bubble machine',
            subject: 'Toddler and bubble machine',
            dialogue: '',
            language: 'en',
            composition: 'Child in foreground, machine in background',
            context_environment: 'Nighttime backyard',
            ambiance_colour_lighting: 'Playful and warm',
            camera_motion_positioning: 'Medium tracking shot',
          },
        ],
      },
    ],
    'Bubbles must spray from the two black outlet housings on the left and right sides of the machine, not from the center.',
  );

  assert.match(segment.first_frame_description, /Product behavior constraint:/);
  assert.match(segment.first_frame_description, /left and right sides of the machine, not from the center/i);
  assert.match(segment.shots?.[0]?.action || '', /Must visibly follow this exact product behavior:/);
  assert.match(segment.shots?.[0]?.action || '', /left and right sides of the machine, not from the center/i);
});

test('avatar ads missing copy asks for script instead of generic text', () => {
  const copy = getProjectAgentFeaturePlaceholderCopy({
    featureType: 'avatar_ads',
    blockedReason: null,
    missingInputs: ['text'],
  });

  assert.equal(copy, 'Connect script to start');
});

test('pending connection path follows the cursor even when a snap target is nearby', () => {
  assert.deepEqual(
    getPendingConnectionPathTarget(
      { x: 320, y: 420 },
      { x: 300, y: 360 },
    ),
    { x: 320, y: 420 },
  );
});

test('blocked feature actions explain the blocking reason before credits', () => {
  assert.equal(
    getFeatureStartActionTitle({
      blockedReason: 'Source video duration is unavailable.',
      estimatedCredits: 264,
    }),
    'Source video duration is unavailable.',
  );
});

test('video-dependent feature credits stay hidden until a video is connected', () => {
  assert.equal(
    shouldShowFeatureEstimatedCredits({
      featureType: 'video_clone',
      estimatedCredits: 264,
      hasConnectedVideo: false,
    }),
    false,
  );
  assert.equal(
    shouldShowFeatureEstimatedCredits({
      featureType: 'video_clone',
      estimatedCredits: 264,
      hasConnectedVideo: true,
    }),
    true,
  );
  assert.equal(
    shouldShowFeatureEstimatedCredits({
      featureType: 'avatar_ads',
      estimatedCredits: 528,
      hasConnectedVideo: false,
    }),
    true,
  );
});
