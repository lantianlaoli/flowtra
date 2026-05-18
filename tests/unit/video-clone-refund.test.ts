import test from 'node:test';
import assert from 'node:assert/strict';
import { getTerminalFailedCloneRefundAmount } from '@/lib/video-clone-workflow';

test('terminal failed clone refunds outstanding generation credits once', () => {
  assert.equal(getTerminalFailedCloneRefundAmount({ status: 'processing', generation_credits_used: 462 }), 462);
  assert.equal(getTerminalFailedCloneRefundAmount({ status: 'failed', generation_credits_used: 0 }), 0);
  assert.equal(getTerminalFailedCloneRefundAmount({ status: 'failed', generation_credits_used: null }), 0);
});
