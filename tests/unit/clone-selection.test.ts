import test from 'node:test';
import assert from 'node:assert/strict';

import { SYSTEM_AVATARS } from '@/lib/default-avatars';
import {
  getPrimaryCloneSelection,
  hasExplicitCloneAvatarSelectionState,
  hasExplicitCloneProductSelectionState,
  normalizeCloneSelections,
  normalizeSelectedIds,
  resolveCloneSelection
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

test('explicit empty avatar selection state blocks fallback founder injection', () => {
  const founder = SYSTEM_AVATARS.find((avatar) => avatar.id === 'system-default-founder');
  assert.ok(founder);

  const draft = {
    selectedAvatars: [],
    selectedProducts: [{ id: 'product-1', name: 'Massage Gun', photoUrl: 'https://example.com/product.png' }]
  };

  assert.equal(hasExplicitCloneAvatarSelectionState(draft), true);
  assert.equal(hasExplicitCloneProductSelectionState(draft), true);

  const resolved = resolveCloneSelection({
    selectedItems: draft.selectedAvatars,
    selectedItem: null,
    fallbackSelection: {
      id: founder.id,
      name: founder.avatar_name,
      photoUrl: founder.photo_url
    },
    allowFallback: !hasExplicitCloneAvatarSelectionState(draft)
  });

  assert.deepEqual(resolved.selections, []);
  assert.equal(resolved.primarySelection, null);
  assert.deepEqual(resolved.selectedIds, []);
});

test('selection fallback still works when clone draft has no explicit avatar state', () => {
  const founder = SYSTEM_AVATARS.find((avatar) => avatar.id === 'system-default-founder');
  assert.ok(founder);

  const resolved = resolveCloneSelection({
    selectedItems: undefined,
    selectedItem: undefined,
    fallbackSelection: {
      id: founder.id,
      name: founder.avatar_name,
      photoUrl: founder.photo_url
    },
    allowFallback: true
  });

  assert.equal(resolved.primarySelection?.id, founder.id);
  assert.deepEqual(resolved.selectedIds, [founder.id]);
});
