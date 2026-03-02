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
