import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS,
  normalizeVideoAspectRatio,
  normalizeVideoModel,
  normalizeVideoResolution,
} from '../../lib/tools/ecommerce-listing-studio';
import { getEcommerceListingStudioCreditCost } from '../../lib/tools/billing-constants';

test('ecommerce listing defaults to Gemini Omni video', () => {
  assert.equal(normalizeVideoModel(undefined), 'gemini_omni_video');
});

test('Gemini Omni video format normalization only allows supported ratios and resolutions', () => {
  assert.equal(normalizeVideoAspectRatio('1:1', 'gemini_omni_video'), '9:16');
  assert.equal(normalizeVideoAspectRatio('16:9', 'gemini_omni_video'), '16:9');
  assert.equal(normalizeVideoResolution('480p', 'gemini_omni_video'), '720p');
  assert.equal(normalizeVideoResolution('4k', 'gemini_omni_video'), '4k');
});

test('Gemini Omni ecommerce listing video billing uses fixed 10-second price tiers', () => {
  assert.equal(ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS, 10);
  assert.equal(
    getEcommerceListingStudioCreditCost({ video: true, videoModel: 'gemini_omni_video', videoResolution: '720p' }),
    63
  );
  assert.equal(
    getEcommerceListingStudioCreditCost({ video: true, videoModel: 'gemini_omni_video', videoResolution: '1080p' }),
    63
  );
  assert.equal(
    getEcommerceListingStudioCreditCost({ video: true, videoModel: 'gemini_omni_video', videoResolution: '4k' }),
    103
  );
});

test('Seedance ecommerce listing video billing uses the 10-second duration', () => {
  assert.equal(
    getEcommerceListingStudioCreditCost({ video: true, videoModel: 'seedance_2_fast', videoResolution: '480p' }),
    158
  );
  assert.equal(
    getEcommerceListingStudioCreditCost({ video: true, videoModel: 'seedance_2', videoResolution: '720p' }),
    413
  );
});
