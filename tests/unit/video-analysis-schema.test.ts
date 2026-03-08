import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analysisToLegacyFlatShots,
  normalizeAnalysisToV2,
} from '@/lib/video-analysis-schema';

test('normalizeAnalysisToV2 upgrades legacy flat analysis with audio summary', () => {
  const normalized = normalizeAnalysisToV2({
    name: 'legacy-demo',
    detected_language: 'en',
    video_duration_seconds: 8,
    shots: [{
      shot_id: 1,
      start_time: '00:00',
      end_time: '00:08',
      duration_seconds: 8,
      first_frame_description: 'Legacy frame description',
      subject: 'Creator',
      context_environment: 'Kitchen',
      action: 'Holds the product up to camera',
      style: 'UGC',
      camera_motion_positioning: 'Static medium shot',
      composition: 'Centered medium framing',
      ambiance_colour_lighting: 'Warm daylight',
      audio_summary: 'Soft room tone and music bed',
      dialogue: 'I use this every morning.'
    }]
  });

  assert.ok(normalized);
  assert.equal(normalized?.schema_version, 2);
  assert.equal(normalized?.shots[0]?.visual.focus_lens_effects, '');
  assert.equal(normalized?.shots[0]?.audio.ambient, 'Soft room tone and music bed');
});

test('analysisToLegacyFlatShots preserves canonical fields for clone/editor payloads', () => {
  const shots = analysisToLegacyFlatShots({
    schema_version: 2,
    name: 'v2-demo',
    detected_language: 'en',
    video_duration_seconds: 8,
    shots: [{
      shot_id: 1,
      timing: {
        start_time: '00:00',
        end_time: '00:08',
        duration_seconds: 8,
      },
      opening_frame: {
        description: 'Canonical opening frame'
      },
      visual: {
        subject: 'Creator',
        action: 'Applies the serum',
        environment: 'Bathroom mirror',
        style: 'Clean lifestyle realism',
        camera: 'Static medium shot',
        composition: 'Centered medium framing',
        focus_lens_effects: 'Shallow depth of field',
        ambiance: 'Warm daylight',
      },
      audio: {
        dialogue: 'I use this every morning.',
        sfx: '',
        ambient: 'Soft bathroom room tone with light piano bed',
      },
      flags: {
        contains_brand: false,
        contains_product: true,
      }
    }]
  });

  assert.equal(shots[0]?.context_environment, 'Bathroom mirror');
  assert.equal(shots[0]?.camera_motion_positioning, 'Static medium shot');
  assert.equal(shots[0]?.ambiance_colour_lighting, 'Warm daylight');
  assert.equal(shots[0]?.focus_lens_effects, 'Shallow depth of field');
  assert.equal(shots[0]?.audio_summary, 'Soft bathroom room tone with light piano bed');
  assert.equal(shots[0]?.dialogue, 'I use this every morning.');
});
