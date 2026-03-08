import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__ } from '@/lib/creator-video-analysis';

test('creator video analysis parser accepts structured audio summary and dialogue fields', () => {
  const payload = {
    choices: [{
      message: {
        content: JSON.stringify({
          schema_version: 2,
          name: 'protein-mix-demo',
          video_duration_seconds: 12,
          detected_language: 'en',
          shots: [{
            shot_id: 1,
            timing: {
              start_time: '00:00',
              end_time: '00:06',
              duration_seconds: 6
            },
            opening_frame: {
              description: 'A hand lifts a scoop of collagen powder above a shaker bottle on a kitchen counter.'
            },
            visual: {
              subject: 'Hand, collagen tub, scoop, shaker bottle',
              action: 'The hand presents the scoop and tips powder toward the bottle.',
              environment: 'Warm home kitchen with neutral backsplash and blender nearby.',
              style: 'UGC product demo with clean lifestyle realism.',
              camera: 'Static close-up framing from countertop height.',
              composition: 'Tight product-focused close-up.',
              focus_lens_effects: '',
              ambiance: 'Soft warm daylight with even indoor fill.'
            },
            audio: {
              dialogue: 'This is the collagen my body actually uses.',
              sfx: '',
              ambient: 'Light kitchen ambience with a soft music bed under the voice.'
            },
            flags: {}
          }]
        })
      }
    }]
  };

  const result = __test__.parseCreatorVideoAnalysisResponse(payload);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const shot = (result.parsed.shots as Array<Record<string, unknown>>)[0];
  assert.deepEqual(shot.audio, {
    dialogue: 'This is the collagen my body actually uses.',
    sfx: '',
    ambient: 'Light kitchen ambience with a soft music bed under the voice.'
  });
});

test('creator video analysis validation rejects speech summary without dialogue transcript', () => {
  const result = __test__.validateStrictShotSchema({
    schema_version: 2,
    name: 'protein-mix-demo',
    video_duration_seconds: 12,
    detected_language: 'en',
    shots: [{
      shot_id: 1,
      timing: {
        start_time: '00:00',
        end_time: '00:06',
        duration_seconds: 6
      },
      opening_frame: {
        description: 'A close-up of a shaker bottle on the counter while a hand points to it.'
      },
      visual: {
        subject: 'Hand and shaker bottle',
        action: 'The hand gestures toward the mixed drink.',
        environment: 'Kitchen counter with neutral tile backsplash.',
        style: 'Natural vertical UGC.',
        camera: 'Static medium close-up.',
        composition: 'Center-framed product shot.',
        focus_lens_effects: '',
        ambiance: 'Bright neutral kitchen lighting.'
      },
      audio: {
        dialogue: '',
        sfx: '',
        ambient: 'Voiceover explains the product benefits over soft music.'
      },
      flags: {}
    }]
  });

  assert.equal(result.valid, false);
  assert.match(result.reason || '', /empty "dialogue"|indicates spoken audio/i);
});

test('creator video analysis validation allows empty dialogue for silent shots', () => {
  const result = __test__.validateStrictShotSchema({
    schema_version: 2,
    name: 'protein-mix-demo',
    video_duration_seconds: 12,
    detected_language: 'en',
    shots: [{
      shot_id: 1,
      timing: {
        start_time: '00:00',
        end_time: '00:06',
        duration_seconds: 6
      },
      opening_frame: {
        description: 'A shaker bottle sits on a cutting board while powder settles inside.'
      },
      visual: {
        subject: 'Shaker bottle and powder',
        action: 'The drink settles after shaking.',
        environment: 'Kitchen countertop scene.',
        style: 'Clean lifestyle product shot.',
        camera: 'Static close-up.',
        composition: 'Centered close-up framing.',
        focus_lens_effects: '',
        ambiance: 'Warm even countertop lighting.'
      },
      audio: {
        dialogue: '',
        sfx: '',
        ambient: 'Soft ambient kitchen tone with a low instrumental bed.'
      },
      flags: {}
    }]
  });

  assert.equal(result.valid, true);
});
