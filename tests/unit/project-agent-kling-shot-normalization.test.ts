import test from 'node:test';
import assert from 'node:assert/strict';

import { KLING_PROMPT_MAX_CHARS, estimateKlingPromptUsage } from '@/lib/kling-prompt-budget';
import { normalizeProjectAgentKlingShots, validateProjectAgentKlingShots } from '@/lib/project-agent/kling-shot-normalization';
import { parseTimelineRange } from '@/lib/segment-shot-timeline';

test('project agent Kling normalization preserves shot count while rebuilding contiguous timing', () => {
  const shots = Array.from({ length: 7 }, (_, index) => ({
    id: index + 1,
    time_range: `00:0${index} - 00:0${index + 1}`,
    subject: `Shot ${index + 1} subject`,
    action: `Shot ${index + 1} action`,
  }));

  const normalized = normalizeProjectAgentKlingShots(shots, 'en');

  assert.equal(normalized.length, 7);

  const ranges = normalized.map((shot) => parseTimelineRange(shot.time_range));
  assert.ok(ranges.every((range) => range !== null));
  assert.equal(ranges[0]?.startSec, 0);
  assert.equal(ranges[ranges.length - 1]?.endSec, 7);

  for (let index = 1; index < ranges.length; index += 1) {
    assert.equal(ranges[index - 1]?.endSec, ranges[index]?.startSec);
  }
});

test('project agent Kling validation rejects scenes above the six-shot provider limit', () => {
  assert.throws(
    () => validateProjectAgentKlingShots(
      Array.from({ length: 7 }, (_, index) => ({
        id: index + 1,
        time_range: `00:0${index} - 00:0${index + 1}`,
        subject: `Shot ${index + 1}`,
      })),
      'en'
    ),
    /at most 6 shots/i
  );
});

test('project agent Kling normalization preserves long stored shot fields without budget trimming', () => {
  const longText = 'cinematic protein demo with supplement details and branded motion beat '.repeat(18).trim();
  const normalized = normalizeProjectAgentKlingShots([{
    id: 1,
    time_range: '00:00 - 00:08',
    subject: longText,
    action: longText,
    dialogue: longText,
    context_environment: longText,
    composition: longText,
    camera_motion_positioning: longText,
    style: longText,
    ambiance_colour_lighting: longText,
    sfx: longText,
    ambient: longText,
  }], 'en');

  assert.equal(normalized.length, 1);
  const usage = estimateKlingPromptUsage({
    shot: {
      subject: normalized[0].subject,
      action: normalized[0].action,
      dialogue: normalized[0].dialogue,
      context_environment: normalized[0].context_environment,
      composition: normalized[0].composition,
      camera_motion_positioning: normalized[0].camera_motion_positioning,
      style: normalized[0].style,
      ambiance_colour_lighting: normalized[0].ambiance_colour_lighting,
      audio: normalized[0].audio,
    },
  });

  assert.equal(usage.originalLength > KLING_PROMPT_MAX_CHARS, true);
  assert.equal(normalized[0].subject, longText);
  assert.equal(normalized[0].action, longText);
});
