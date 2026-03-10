import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROJECT_AGENT_DEFAULT_SHOT_TIME_RANGE,
  parseProjectAgentLegacyAudioField,
  serializeProjectAgentCloneShot,
} from '@/lib/project-agent/clone-prompt-schema';

test('project agent clone shot parsing keeps split SFX and ambient fields', () => {
  assert.deepEqual(
    parseProjectAgentLegacyAudioField('SFX: Soft click | Ambient: Low room tone'),
    {
      sfx: 'Soft click',
      ambient: 'Low room tone',
    }
  );
});

test('serializing a clone shot rebuilds compatibility audio from sfx and ambient', () => {
  const shot = serializeProjectAgentCloneShot({
    id: 7,
    sfx: 'Package tap',
    ambient: 'Quiet bedroom tone',
    audio: 'outdated combined text',
    subject: 'Hero product close-up',
  }, 0, 'en');

  assert.equal(shot.id, 1);
  assert.equal(shot.time_range, PROJECT_AGENT_DEFAULT_SHOT_TIME_RANGE);
  assert.equal(shot.sfx, 'Package tap');
  assert.equal(shot.ambient, 'Quiet bedroom tone');
  assert.equal(shot.audio, 'SFX: Package tap | Ambient: Quiet bedroom tone');
  assert.equal(shot.subject, 'Hero product close-up');
});
