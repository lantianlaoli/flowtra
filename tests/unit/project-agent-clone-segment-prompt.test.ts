import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cloneDraftSceneToSegmentPrompt,
  getProjectAgentSegmentPromptDurationSeconds,
} from '@/lib/project-agent/clone-segment-prompt';

test('clone draft scene conversion keeps Kling structured shots and rebuilds legacy audio', () => {
  const segmentPrompt = cloneDraftSceneToSegmentPrompt({
    sceneIndex: 2,
    imagePrompt: 'Replace the original demo with the user product on a sink ledge.',
    isContinuation: true,
    sourceSummary: 'Demo beat',
    videoPrompt: {
      shots: [
        {
          id: 9,
          time_range: '00:00 - 00:04',
          subject: 'Product on sink ledge',
          sfx: 'Bottle cap click',
          ambient: 'Soft bathroom room tone',
          audio: 'legacy audio should be replaced',
          dialogue: '',
        },
        {
          id: 10,
          time_range: '00:04 - 00:11',
          subject: 'Hand applies product',
          sfx: '',
          ambient: 'Low beauty-pop music bed',
          dialogue: 'This is the easy part.',
        },
      ],
    },
  }, 'en');

  assert.equal(segmentPrompt.index, 1);
  assert.equal(segmentPrompt.is_continuation_from_prev, true);
  assert.equal(segmentPrompt.shots?.[0]?.audio, 'SFX: Bottle cap click | Ambient: Soft bathroom room tone');
  assert.equal(segmentPrompt.shots?.[1]?.audio, 'Ambient: Low beauty-pop music bed');
});

test('clone segment duration follows the last shot time_range end', () => {
  const segmentPrompt = cloneDraftSceneToSegmentPrompt({
    sceneIndex: 1,
    imagePrompt: 'Hook frame',
    videoPrompt: {
      shots: [
        { id: 1, time_range: '00:00 - 00:03', subject: 'Hook' },
        { id: 2, time_range: '00:03 - 00:12', subject: 'Payoff' },
      ],
    },
  }, 'en');

  assert.equal(getProjectAgentSegmentPromptDurationSeconds(segmentPrompt), 12);
});

test('clone draft scene conversion rejects oversized Kling shot lists so planning must split them earlier', () => {
  assert.throws(
    () => cloneDraftSceneToSegmentPrompt({
      sceneIndex: 1,
      imagePrompt: 'Dense scene',
      videoPrompt: {
        shots: Array.from({ length: 7 }, (_, index) => ({
          id: index + 1,
          time_range: `00:0${index} - 00:0${index + 1}`,
          subject: `Beat ${index + 1}`,
          action: `Action ${index + 1}`,
        })),
      },
    }, 'en'),
    /at most 6 shots/i
  );
});
