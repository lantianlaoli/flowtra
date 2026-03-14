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
    video_duration_seconds: 6,
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

test('creator video analysis validation allows small duration mismatch within tolerance', () => {
  const result = __test__.validateStrictShotSchema({
    schema_version: 2,
    name: 'protein-mix-demo',
    video_duration_seconds: 15,
    detected_language: 'en',
    shots: [{
      shot_id: 1,
      timing: {
        start_time: '00:00',
        end_time: '00:08',
        duration_seconds: 8
      },
      opening_frame: {
        description: 'A creator holds a shaker bottle near the camera.'
      },
      visual: {
        subject: 'Creator and shaker bottle',
        action: 'The creator introduces the product while gesturing to camera.',
        environment: 'Car interior in daylight.',
        style: 'Natural handheld UGC.',
        camera: 'Static front-facing medium close-up.',
        composition: 'Centered talking-head frame.',
        focus_lens_effects: '',
        ambiance: 'Soft daylight through the windshield.'
      },
      audio: {
        dialogue: 'This is the one I keep in my car every day.',
        sfx: '',
        ambient: 'Light road ambience underneath the voice.'
      },
      flags: {}
    }, {
      shot_id: 2,
      timing: {
        start_time: '00:08',
        end_time: '00:17',
        duration_seconds: 9
      },
      opening_frame: {
        description: 'The creator lifts the bottle and points to the label.'
      },
      visual: {
        subject: 'Creator, bottle, product label',
        action: 'He rotates the bottle and points at the packaging.',
        environment: 'Same car interior setting.',
        style: 'Conversational product endorsement.',
        camera: 'Locked medium close-up.',
        composition: 'Subject centered with bottle in foreground.',
        focus_lens_effects: '',
        ambiance: 'Balanced natural interior light.'
      },
      audio: {
        dialogue: 'It gives me exactly what I need before the gym.',
        sfx: '',
        ambient: 'Quiet in-car ambience with subtle traffic noise.'
      },
      flags: {}
    }]
  });

  assert.equal(result.valid, true);
});
