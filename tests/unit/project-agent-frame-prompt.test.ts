import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__ } from '@/lib/competitor-ugc-replication-workflow';

test('project agent frame prompt uses image prompt as primary source', () => {
  const prompt = __test__.buildProjectAgentFramePrompt({
    segmentIndex: 0,
    frameType: 'first',
    frameDescription: 'A close-up of a hand holding the massager in a bedroom.',
    isBrandShot: false
  });

  assert.match(prompt, /Description: A close-up of a hand holding the massager in a bedroom\./);
  assert.doesNotMatch(prompt, /Lighting:/);
  assert.doesNotMatch(prompt, /Camera:/);
  assert.doesNotMatch(prompt, /Setting:/);
});

test('cleanSegmentText removes orphan possessive fragments', () => {
  assert.equal(
    __test__.cleanSegmentText("A close-up of 's hand holding the device."),
    'A close-up of hand holding the device.'
  );
});

test('continuation scenes wait for previous first frame before starting', () => {
  assert.equal(
    __test__.shouldWaitForContinuationFrame({
      segmentIndex: 1,
      isContinuationFromPrev: true
    }),
    true
  );
  assert.equal(
    __test__.shouldWaitForContinuationFrame({
      segmentIndex: 1,
      isContinuationFromPrev: false
    }),
    false
  );
  assert.equal(
    __test__.shouldWaitForContinuationFrame({
      segmentIndex: 0,
      isContinuationFromPrev: true
    }),
    false
  );
});

test('structured video prompt payload keeps only shot content', () => {
  const payload = __test__.buildStructuredVideoPromptPayload({
    normalizedShots: [{
      time_range: '00:00 - 00:06',
      subject: 'Default Male in frame',
      context_environment: 'Bathroom interior',
      action: 'Continues the massaging motion',
      style: 'Vertical video, close-up detail shot',
      camera_motion_positioning: 'Static framing',
      composition: 'Tight focus on the device and skin',
      ambiance_colour_lighting: 'Bright bathroom lighting',
      audio: 'Low mechanical hum',
      dialogue: '',
      language: 'en'
    }]
  });

  assert.deepEqual(Object.keys(payload), ['shots']);
  assert.equal(payload.shots.length, 1);
  assert.equal(payload.shots[0].action, 'Continues the massaging motion');
});

test('Kling prompt scene duration follows the scene shot time range end', () => {
  assert.equal(
    __test__.getPromptSegmentDurationSeconds({
      shots: [
        {
          time_range: '00:00 - 00:03'
        },
        {
          time_range: '00:03 - 00:11'
        }
      ]
    }),
    11
  );
});

test('Kling multi-shot durations preserve explicit workspace shot timing', () => {
  assert.deepEqual(
    __test__.deriveKlingShotDurationsFromSourceShots(
      [
        {
          time_range: '00:00 - 00:03',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        },
        {
          time_range: '00:03 - 00:06',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        },
        {
          time_range: '00:06 - 00:09',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        },
        {
          time_range: '00:09 - 00:11',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        },
        {
          time_range: '00:11 - 00:13',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        }
      ],
      5,
      13
    ),
    [3, 3, 3, 2, 2]
  );
});
