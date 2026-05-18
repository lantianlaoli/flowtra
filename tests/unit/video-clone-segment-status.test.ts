import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getFailedSegmentErrorMessage,
  shouldRetryCloneVideoFailure,
} from '@/lib/video-clone-workflow';

test('failed segment aggregation exposes the first segment error for project failure state', () => {
  const error = getFailedSegmentErrorMessage([
    { status: 'completed', error_message: null },
    { status: 'failed', error_message: 'Provider rejected audio generation.' },
  ] as never[]);

  assert.equal(error, 'Provider rejected audio generation.');
});

test('provider safety failures are not retried so their original message is preserved', () => {
  assert.equal(shouldRetryCloneVideoFailure({
    code: 501,
    failCode: '501',
    failMsg: 'The request failed because the output audio may contain sensitive information.',
    retryCount: 0,
    maxRetries: 3,
  }), false);
});
