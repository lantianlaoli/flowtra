import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProjectAgentCanvasNotice,
  getProjectAgentFeaturePlaceholderCopy,
} from '@/lib/project-agent/canvas-ui';
import {
  applySupplementalTextToSegments,
  buildSupplementalTextPromptInstruction,
} from '@/lib/video-clone-workflow';

test('video clone ready copy mentions optional text guidance', () => {
  const copy = getProjectAgentFeaturePlaceholderCopy({
    featureType: 'video_clone',
    blockedReason: null,
    missingInputs: [],
  });

  assert.equal(copy, 'Ready to start. Optionally connect a Text node to add product behavior details.');
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
