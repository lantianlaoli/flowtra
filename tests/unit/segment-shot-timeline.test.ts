import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS,
  FIRST_SHOT_MIN_DURATION_SECONDS,
  formatSecondsToTimecode,
  formatTimelineRange,
  normalizeTimelineRanges,
  serializeTimelineRanges,
  updateTimelineBoundary,
  updateTimelineEnd,
} from '@/lib/segment-shot-timeline';

test('formatSecondsToTimecode returns mm:ss strings for segment ranges', () => {
  assert.equal(formatSecondsToTimecode(0), '00:00');
  assert.equal(formatSecondsToTimecode(5), '00:05');
  assert.equal(formatSecondsToTimecode(75), '01:15');
});

test('segment timeline defaults to the 15 second single-generation ruler domain', () => {
  assert.equal(DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS, 15);
  assert.equal(FIRST_SHOT_MIN_DURATION_SECONDS, 3);
});

test('normalizeTimelineRanges keeps shots contiguous using existing durations', () => {
  const ranges = normalizeTimelineRanges([
    { id: 1, time_range: '00:00 - 00:02' },
    { id: 2, time_range: '00:02 - 00:05' },
    { id: 3, time_range: '00:05 - 00:08' },
  ], 8);

  assert.deepEqual(ranges, [
    { id: 1, startSec: 0, endSec: 2 },
    { id: 2, startSec: 2, endSec: 5 },
    { id: 3, startSec: 5, endSec: 8 },
  ]);
});

test('normalizeTimelineRanges falls back to evenly distributed segment timing', () => {
  const ranges = normalizeTimelineRanges([
    { id: 1, time_range: '' },
    { id: 2, time_range: undefined },
    { id: 3, time_range: null },
  ], 9);

  assert.deepEqual(ranges, [
    { id: 1, startSec: 0, endSec: 3 },
    { id: 2, startSec: 3, endSec: 6 },
    { id: 3, startSec: 6, endSec: 9 },
  ]);
});

test('normalizeTimelineRanges distributes shot timing across a 15 second ruler', () => {
  const ranges = normalizeTimelineRanges([
    { id: 1, time_range: '' },
    { id: 2, time_range: '' },
    { id: 3, time_range: '' },
    { id: 4, time_range: '' },
    { id: 5, time_range: '' },
  ], DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS);

  assert.deepEqual(ranges, [
    { id: 1, startSec: 0, endSec: 3 },
    { id: 2, startSec: 3, endSec: 6 },
    { id: 3, startSec: 6, endSec: 9 },
    { id: 4, startSec: 9, endSec: 12 },
    { id: 5, startSec: 12, endSec: 15 },
  ]);
});

test('updateTimelineBoundary moves adjacent shot boundaries together', () => {
  const next = updateTimelineBoundary([
    { id: 1, startSec: 0, endSec: 2 },
    { id: 2, startSec: 2, endSec: 5 },
    { id: 3, startSec: 5, endSec: 8 },
  ], 1, 3, 1);

  assert.deepEqual(next, [
    { id: 1, startSec: 0, endSec: 3 },
    { id: 2, startSec: 3, endSec: 5 },
    { id: 3, startSec: 5, endSec: 8 },
  ]);
});

test('updateTimelineBoundary enforces minimum shot duration', () => {
  const next = updateTimelineBoundary([
    { id: 1, startSec: 0, endSec: 2 },
    { id: 2, startSec: 2, endSec: 5 },
  ], 1, 0, 1);

  assert.deepEqual(next, [
    { id: 1, startSec: 0, endSec: 3 },
    { id: 2, startSec: 3, endSec: 5 },
  ]);
});

test('updateTimelineBoundary enforces a 3 second minimum for shot 1', () => {
  const next = updateTimelineBoundary([
    { id: 1, startSec: 0, endSec: 5 },
    { id: 2, startSec: 5, endSec: 8 },
  ], 1, 1, 1);

  assert.deepEqual(next, [
    { id: 1, startSec: 0, endSec: 3 },
    { id: 2, startSec: 3, endSec: 8 },
  ]);
});

test('updateTimelineEnd allows dragging the last shot end within the 15 second ruler', () => {
  const next = updateTimelineEnd([
    { id: 1, startSec: 0, endSec: 3 },
    { id: 2, startSec: 3, endSec: 6 },
    { id: 3, startSec: 6, endSec: 10 },
  ], 14, 1, DEFAULT_SEGMENT_TIMELINE_DURATION_SECONDS);

  assert.deepEqual(next, [
    { id: 1, startSec: 0, endSec: 3 },
    { id: 2, startSec: 3, endSec: 6 },
    { id: 3, startSec: 6, endSec: 14 },
  ]);
});

test('serializeTimelineRanges converts ranges back to editor strings', () => {
  assert.deepEqual(
    serializeTimelineRanges([
      { id: 1, startSec: 0, endSec: 2 },
      { id: 2, startSec: 2, endSec: 5 },
    ]),
    [
      { id: 1, time_range: formatTimelineRange(0, 2) },
      { id: 2, time_range: formatTimelineRange(2, 5) },
    ],
  );
});
