import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__ } from '@/lib/creator-video-analysis';

test('creator video analysis parser accepts structured audio summary and dialogue fields', () => {
  const payload = {
    choices: [{
      message: {
        content: JSON.stringify({
          name: 'protein-mix-demo',
          video_duration_seconds: 12,
          detected_language: 'en',
          shots: [{
            shot_id: 1,
            start_time: '00:00',
            end_time: '00:06',
            duration_seconds: 6,
            first_frame_description: 'A hand lifts a scoop of collagen powder above a shaker bottle on a kitchen counter.',
            subject: 'Hand, collagen tub, scoop, shaker bottle',
            context_environment: 'Warm home kitchen with neutral backsplash and blender nearby.',
            action: 'The hand presents the scoop and tips powder toward the bottle.',
            style: 'UGC product demo with clean lifestyle realism.',
            camera_motion_positioning: 'Static close-up framing from countertop height.',
            composition: 'Tight product-focused close-up.',
            ambiance_colour_lighting: 'Soft warm daylight with even indoor fill.',
            audio_summary: 'Light kitchen ambience with a soft music bed under the voice.',
            dialogue: 'This is the collagen my body actually uses.'
          }]
        })
      }
    }]
  };

  const result = __test__.parseCreatorVideoAnalysisResponse(payload);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const shot = (result.parsed.shots as Array<Record<string, unknown>>)[0];
  assert.equal(shot.audio_summary, 'Light kitchen ambience with a soft music bed under the voice.');
  assert.equal(shot.dialogue, 'This is the collagen my body actually uses.');
});

test('creator video analysis validation rejects speech summary without dialogue transcript', () => {
  const result = __test__.validateStrictShotSchema({
    name: 'protein-mix-demo',
    video_duration_seconds: 12,
    detected_language: 'en',
    shots: [{
      shot_id: 1,
      start_time: '00:00',
      end_time: '00:06',
      duration_seconds: 6,
      first_frame_description: 'A close-up of a shaker bottle on the counter while a hand points to it.',
      subject: 'Hand and shaker bottle',
      context_environment: 'Kitchen counter with neutral tile backsplash.',
      action: 'The hand gestures toward the mixed drink.',
      style: 'Natural vertical UGC.',
      camera_motion_positioning: 'Static medium close-up.',
      composition: 'Center-framed product shot.',
      ambiance_colour_lighting: 'Bright neutral kitchen lighting.',
      audio_summary: 'Voiceover explains the product benefits over soft music.',
      dialogue: ''
    }]
  });

  assert.equal(result.valid, false);
  assert.match(result.reason || '', /empty "dialogue"|indicates spoken audio/i);
});

test('creator video analysis validation allows empty dialogue for silent shots', () => {
  const result = __test__.validateStrictShotSchema({
    name: 'protein-mix-demo',
    video_duration_seconds: 12,
    detected_language: 'en',
    shots: [{
      shot_id: 1,
      start_time: '00:00',
      end_time: '00:06',
      duration_seconds: 6,
      first_frame_description: 'A shaker bottle sits on a cutting board while powder settles inside.',
      subject: 'Shaker bottle and powder',
      context_environment: 'Kitchen countertop scene.',
      action: 'The drink settles after shaking.',
      style: 'Clean lifestyle product shot.',
      camera_motion_positioning: 'Static close-up.',
      composition: 'Centered close-up framing.',
      ambiance_colour_lighting: 'Warm even countertop lighting.',
      audio_summary: 'Soft ambient kitchen tone with a low instrumental bed.',
      dialogue: ''
    }]
  });

  assert.equal(result.valid, true);
});
