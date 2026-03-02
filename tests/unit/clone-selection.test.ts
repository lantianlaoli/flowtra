import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPrimaryCloneSelection,
  normalizeCloneSelections,
  normalizeSelectedIds
} from '@/lib/project-agent/clone-selection';

test('normalizeCloneSelections keeps array order and appends legacy selection only when missing', () => {
  const selections = normalizeCloneSelections(
    [
      { id: 'avatar-2', name: 'Avatar Two' },
      { id: 'avatar-1', name: 'Avatar One' }
    ],
    { id: 'avatar-3', name: 'Avatar Three' }
  );

  assert.deepEqual(
    selections.map((item) => item.id),
    ['avatar-2', 'avatar-1', 'avatar-3']
  );
});

test('getPrimaryCloneSelection returns the first normalized selection', () => {
  const primary = getPrimaryCloneSelection(
    [{ id: 'product-2', name: 'Product Two' }],
    { id: 'product-1', name: 'Product One' }
  );

  assert.equal(primary?.id, 'product-2');
});

test('normalizeSelectedIds dedupes primary id and trims invalid values', () => {
  const normalized = normalizeSelectedIds(' avatar-1 ', ['avatar-1', 'avatar-2', '', '  ', 'avatar-3'], 8);

  assert.deepEqual(normalized, ['avatar-1', 'avatar-2', 'avatar-3']);
});

test('normalizeSelectedIds respects the limit after dedupe', () => {
  const normalized = normalizeSelectedIds(null, ['1', '2', '3', '4'], 2);

  assert.deepEqual(normalized, ['1', '2']);
});
