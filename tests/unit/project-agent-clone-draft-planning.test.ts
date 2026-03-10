import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectAgentCloneDraftSeeds } from '@/lib/project-agent/clone-draft-planning';
import { parseTimelineRange } from '@/lib/segment-shot-timeline';

test('project agent clone draft planning uses Kling scene segmentation instead of one scene per analyzed shot', () => {
  const result = buildProjectAgentCloneDraftSeeds({
    referenceDurationSeconds: 22,
    language: 'en',
    analysisResult: {
      schema_version: 2,
      name: 'Reference',
      detected_language: 'en',
      video_duration_seconds: 22,
      shots: [
        {
          shot_id: 1,
          timing: { start_time: '00:00', end_time: '00:06', duration_seconds: 6 },
          opening_frame: { description: 'Hook frame' },
          visual: {
            subject: 'Hook subject',
            action: 'Hook action',
            environment: 'Bathroom',
            style: 'UGC',
            camera: 'Close handheld',
            composition: 'Tight product crop',
            focus_lens_effects: '',
            ambiance: 'Bright cool light',
          },
          audio: { dialogue: '', sfx: 'Tap', ambient: 'Bathroom room tone' },
          flags: {},
        },
        {
          shot_id: 2,
          timing: { start_time: '00:06', end_time: '00:12', duration_seconds: 6 },
          opening_frame: { description: 'Demo frame' },
          visual: {
            subject: 'Demo subject',
            action: 'Demo action',
            environment: 'Bedroom',
            style: 'UGC',
            camera: 'Mid shot',
            composition: 'Centered',
            focus_lens_effects: '',
            ambiance: 'Warm indoor light',
          },
          audio: { dialogue: '', sfx: '', ambient: 'Music bed' },
          flags: {},
        },
        {
          shot_id: 3,
          timing: { start_time: '00:12', end_time: '00:17', duration_seconds: 5 },
          opening_frame: { description: 'Proof frame' },
          visual: {
            subject: 'Proof subject',
            action: 'Proof action',
            environment: 'Desk',
            style: 'UGC',
            camera: 'Overhead',
            composition: 'Layered props',
            focus_lens_effects: '',
            ambiance: 'Soft daylight',
          },
          audio: { dialogue: '', sfx: '', ambient: 'Soft room tone' },
          flags: {},
        },
        {
          shot_id: 4,
          timing: { start_time: '00:17', end_time: '00:22', duration_seconds: 5 },
          opening_frame: { description: 'CTA frame' },
          visual: {
            subject: 'CTA subject',
            action: 'CTA action',
            environment: 'Studio',
            style: 'UGC',
            camera: 'Static hero',
            composition: 'Centered hero',
            focus_lens_effects: '',
            ambiance: 'Clean white light',
          },
          audio: { dialogue: 'Try it now.', sfx: 'Click', ambient: 'Light pop bed' },
          flags: {},
        },
      ],
    },
  });

  assert.equal(result.duration, '22');
  assert.equal(result.scenes.length, 2);

  const sceneDurations = result.scenes.map((scene) => {
    const endTimes = scene.videoPrompt.shots
      .map((shot) => parseTimelineRange(shot.time_range)?.endSec ?? 0);
    return Math.max(...endTimes);
  });

  assert.deepEqual(sceneDurations, [12, 10]);
  assert.ok(sceneDurations.every((duration) => duration >= 3 && duration <= 15));
  assert.equal(result.scenes[1]?.isContinuation, true);
});

test('project agent clone draft planning rejects reference videos longer than Kling limit', () => {
  assert.throws(
    () => buildProjectAgentCloneDraftSeeds({
      referenceDurationSeconds: 61,
      fallbackShots: ['One', 'Two'],
      language: 'en',
    }),
    /up to 60 seconds/i
  );
});
