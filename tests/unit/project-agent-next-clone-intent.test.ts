import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideNextCloneFollowup,
  getNextCloneCanonicalGuidance,
  getNextCloneClarificationReply,
  isAmbiguousNextCloneFollowup,
  isCloneFlowEffectivelyFinished,
  isNextCloneIntentMessage,
} from '@/lib/project-agent/next-clone-intent';

test('next clone intent matches explicit post-completion commands', () => {
  assert.equal(isNextCloneIntentMessage('clone another video'), true);
  assert.equal(isNextCloneIntentMessage('next clone'), true);
  assert.equal(isNextCloneIntentMessage('show more reference videos'), true);
  assert.equal(isNextCloneIntentMessage("let's clone a new video"), true);
});

test('next clone intent rejects overloaded or unrelated commands', () => {
  assert.equal(isNextCloneIntentMessage('create final video'), false);
  assert.equal(isNextCloneIntentMessage('download it'), false);
  assert.equal(isNextCloneIntentMessage('try again'), false);
  assert.equal(isNextCloneIntentMessage('next'), false);
  assert.equal(isNextCloneIntentMessage('another one'), false);
});

test('ambiguous next-clone followups stay ambiguous', () => {
  assert.equal(isAmbiguousNextCloneFollowup('again'), true);
  assert.equal(isAmbiguousNextCloneFollowup('another one'), true);
  assert.equal(isAmbiguousNextCloneFollowup('next'), true);
  assert.equal(isAmbiguousNextCloneFollowup('clone another video'), false);
});

test('clone flow effective completion detects merging or final output', () => {
  assert.equal(isCloneFlowEffectivelyFinished({ phase: 'completed', mergedVideoUrl: null }), true);
  assert.equal(isCloneFlowEffectivelyFinished({ phase: 'merging', mergedVideoUrl: null }), true);
  assert.equal(isCloneFlowEffectivelyFinished({ phase: 'awaiting_merge', mergedVideoUrl: 'https://cdn.example/video.mp4' }), true);
  assert.equal(isCloneFlowEffectivelyFinished({ phase: 'awaiting_merge', mergedVideoUrl: null }), false);
});

test('completed clone resets only on explicit next-clone intent', () => {
  const snapshot = { phase: 'completed', mergedVideoUrl: 'https://cdn.example/final.mp4' };
  assert.equal(decideNextCloneFollowup('clone another video', snapshot), 'reset');
  assert.equal(decideNextCloneFollowup('show more reference videos', snapshot), 'reset');
  assert.equal(decideNextCloneFollowup('download it', snapshot), 'none');
  assert.equal(decideNextCloneFollowup('try again', snapshot), 'clarify-finished');
});

test('in-progress clone does not silently wipe when user asks for another clone', () => {
  const snapshot = { phase: 'generating_videos', mergedVideoUrl: null };
  assert.equal(decideNextCloneFollowup('clone another video', snapshot), 'clarify-in-progress');
  assert.equal(decideNextCloneFollowup('show more reference videos', snapshot), 'clarify-in-progress');
  assert.equal(decideNextCloneFollowup('create final video', snapshot), 'none');
});

test('next clone guidance strings stay canonical and short', () => {
  assert.equal(
    getNextCloneCanonicalGuidance(),
    'If you want to clone another video, say "clone another video" or "show more reference videos".'
  );
  assert.match(
    getNextCloneClarificationReply('clarify-finished'),
    /clone another video|show more reference videos/i
  );
});
