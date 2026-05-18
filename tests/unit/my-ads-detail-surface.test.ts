import assert from 'node:assert/strict';
import test from 'node:test';
import { getMyAdsDetailSurfaceMode } from '@/lib/my-ads-detail-surface';

test('embedded my ads uses panel detail surface while standalone uses modal surface', () => {
  assert.equal(getMyAdsDetailSurfaceMode(true), 'embedded');
  assert.equal(getMyAdsDetailSurfaceMode(false), 'modal');
});
