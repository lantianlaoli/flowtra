import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateDialogueDuration } from '@/lib/dialogue-duration-estimator';
import { buildAvatarGeneratedPrompts } from '@/lib/project-agent/avatar-script-planning';

const BOXING_MITTS_SCRIPT = `Just got these boxing focus mitts for only $25.99 — honestly such a steal.

They’re made with durable faux leather and thick 1.5-inch padding, so they absorb punches really well without hurting your hands. The curved design makes every hit feel super natural and accurate.

Plus, the adjustable wrist strap fits snug, so they won’t slip during training. Perfect for boxing, kickboxing, or even just home workouts.

If you’re starting out or want solid mitts without spending a lot, this is definitely worth it.`;

test('Avatar planner keeps risky English copy under Kling safety headroom', () => {
  const result = buildAvatarGeneratedPrompts({
    imagePrompt: null,
    scriptSource: BOXING_MITTS_SCRIPT,
    language: 'en',
    avatarName: 'Coach Alex',
    productName: 'Boxing Focus Mitts'
  });

  assert.equal(result.scenes.length >= 3, true);

  result.scenes.forEach((scene) => {
    const dialog = String(scene.prompt.dialog || '');
    const duration = Number(scene.prompt.duration_seconds);
    const estimated = estimateDialogueDuration(dialog, 'en');

    assert.equal(duration <= 14, true);
    assert.equal(estimated <= 14, true);
    assert.doesNotMatch(dialog, /[,;:—–]\s*$/);
  });
});

test('Avatar planner does not keep the boxing mitts opening in an unsafe 11 second scene', () => {
  const result = buildAvatarGeneratedPrompts({
    imagePrompt: null,
    scriptSource: BOXING_MITTS_SCRIPT,
    language: 'en',
    avatarName: 'Coach Alex',
    productName: 'Boxing Focus Mitts'
  });

  const firstScene = result.scenes[0];
  const firstDialog = String(firstScene.prompt.dialog || '');
  const firstDuration = Number(firstScene.prompt.duration_seconds);

  assert.match(firstDialog, /such a steal\./i);
  assert.doesNotMatch(firstDialog, /1\.5-inch padding,\s*$/i);
  assert.notEqual(firstDuration, 11);
  assert.equal(firstDuration <= 10, true);
});

test('Avatar planner only merges a short tail when the merged scene still has safe headroom', () => {
  const result = buildAvatarGeneratedPrompts({
    imagePrompt: null,
    scriptSource: 'This part explains the benefits in a natural rhythm. This is a very short ending.',
    language: 'en',
    avatarName: 'Coach Alex',
    productName: 'Boxing Focus Mitts'
  });

  const lastScene = result.scenes[result.scenes.length - 1];
  const lastDialog = String(lastScene.prompt.dialog || '');
  const estimated = estimateDialogueDuration(lastDialog, 'en');

  assert.equal(estimated <= 14, true);
});
