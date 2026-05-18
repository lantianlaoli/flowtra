import assert from 'node:assert/strict';
import test from 'node:test';
import { getAssetsDetailSurfaceMode } from '../../lib/assets-detail-surface';

test('assets uses embedded detail surfaces inside the agent workspace', () => {
  assert.equal(getAssetsDetailSurfaceMode(true), 'embedded');
});

test('assets keeps modal detail surfaces outside the agent workspace', () => {
  assert.equal(getAssetsDetailSurfaceMode(false), 'modal');
});
