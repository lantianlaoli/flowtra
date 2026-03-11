import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveProjectAgentCloneMergedVideoUrl,
  shouldShowProjectAgentCloneMergedReview,
} from '@/lib/project-agent/clone-execution';

test('single-scene clone execution does not treat the scene video as a merged final asset', () => {
  const mergedVideoUrl = resolveProjectAgentCloneMergedVideoUrl({
    videoUrl: 'https://example.com/scene-only.mp4',
    segments: [{ videoUrl: 'https://example.com/scene-only.mp4' }],
  });

  assert.equal(mergedVideoUrl, null);
  assert.equal(
    shouldShowProjectAgentCloneMergedReview({
      phase: 'completed',
      mergedVideoUrl,
    }),
    false
  );
});

test('multi-scene clone execution keeps the merged final asset URL', () => {
  const mergedVideoUrl = resolveProjectAgentCloneMergedVideoUrl({
    videoUrl: 'https://example.com/final-merged.mp4',
    segments: [
      { videoUrl: 'https://example.com/segment-1.mp4' },
      { videoUrl: 'https://example.com/segment-2.mp4' },
    ],
  });

  assert.equal(mergedVideoUrl, 'https://example.com/final-merged.mp4');
  assert.equal(
    shouldShowProjectAgentCloneMergedReview({
      phase: 'completed',
      mergedVideoUrl,
    }),
    true
  );
});
