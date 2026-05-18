import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMyAdsStatusPresentation,
  shouldShowMyAdsTypeFilters,
} from '../../lib/my-ads-list-presentation';

test('embedded my ads hides type filters while standalone keeps them', () => {
  assert.equal(shouldShowMyAdsTypeFilters(true), false);
  assert.equal(shouldShowMyAdsTypeFilters(false), true);
});

test('my ads status presentation exposes icon semantics and accessible labels', () => {
  assert.deepEqual(getMyAdsStatusPresentation('completed'), {
    icon: 'completed',
    label: 'Completed',
  });
  assert.deepEqual(getMyAdsStatusPresentation('processing'), {
    icon: 'processing',
    label: 'Processing',
  });
  assert.deepEqual(getMyAdsStatusPresentation('failed'), {
    icon: 'failed',
    label: 'Failed',
  });
});
