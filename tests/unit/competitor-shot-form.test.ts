import test from 'node:test';
import assert from 'node:assert/strict';

import { parseShotsFromAnalysis } from '@/lib/competitor-shot-form';

test('parseShotsFromAnalysis keeps separate audio summary and dialogue fields', () => {
  const shots = parseShotsFromAnalysis([{
    shot_id: 1,
    start_time: '00:00',
    end_time: '00:04',
    duration_seconds: 4,
    first_frame_description: 'A hand holds a collagen scoop in front of a shaker bottle.',
    subject: 'Hand with collagen scoop',
    context_environment: 'Kitchen counter',
    action: 'The hand lifts the scoop into frame.',
    style: 'UGC kitchen demo',
    camera_motion_positioning: 'Static close-up',
    composition: 'Tight product framing',
    ambiance_colour_lighting: 'Warm indoor light',
    audio_summary: 'Low-fi background music and light room tone.',
    dialogue: 'This is the collagen my body actually uses.'
  }]);

  assert.equal(shots[0]?.audio_summary, 'Low-fi background music and light room tone.');
  assert.equal(shots[0]?.dialogue, 'This is the collagen my body actually uses.');
});

test('parseShotsFromAnalysis preserves legacy audio-only records', () => {
  const shots = parseShotsFromAnalysis([{
    shot_id: 1,
    start_time: 0,
    end_time: 4,
    duration_seconds: 4,
    description: 'Legacy imported shot record.',
    subject: 'Shaker bottle',
    environment: 'Kitchen',
    action: 'Bottle rests on the counter.',
    visual_style: 'UGC product shot',
    camera_motion: 'Static close-up',
    framing: 'Centered close-up',
    lighting: 'Warm indoor light',
    audio: 'Voiceover explaining the product benefits.'
  }]);

  assert.equal(shots[0]?.audio_summary, 'Voiceover explaining the product benefits.');
  assert.equal(shots[0]?.dialogue, '');
  assert.equal(shots[0]?.start_time, '00:00');
  assert.equal(shots[0]?.end_time, '00:04');
});
