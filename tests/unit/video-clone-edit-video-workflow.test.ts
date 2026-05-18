import test from 'node:test';
import assert from 'node:assert/strict';
import { __test__ } from '@/lib/video-clone-workflow';

test('seedance edit-video request uses reference video urls instead of frame inputs', () => {
  const request = __test__.buildSeedanceEditVideoRequestBody({
    projectId: 'project-1',
    model: 'seedance_2',
    prompt: 'Make the scene warmer.',
    referenceVideoUrl: 'https://example.com/source.mp4',
    aspectRatio: '9:16',
    resolution: '1080p',
    duration: 9,
  });

  assert.equal(request.model, 'bytedance/seedance-2');
  assert.deepEqual(request.input.reference_video_urls, ['https://example.com/source.mp4']);
  assert.equal(request.input.prompt, 'Make the scene warmer.');
  assert.equal(request.input.duration, 9);
  assert.equal(request.input.generate_audio, true);
  assert.equal(request.input.fixed_lens, false);
  assert.equal('input_urls' in request.input, false);
});
