import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__ } from '@/lib/competitor-ugc-replication-workflow';

test('Kling video request body defaults input.mode to std', () => {
  const requestBody = __test__.buildKlingVideoRequestBody({
    projectId: 'project-123',
    segmentIndex: 1,
    aspectRatio: '9:16',
    quality: '720p',
    imageUrls: ['https://example.com/frame-1.png'],
    boundedDuration: 8,
    hasMultipleShots: false,
    multiPrompt: [],
    prompt: 'Creator reveals the product in a clean close-up.',
    elements: []
  }) as {
    model: string;
    callBackUrl: string;
    input: Record<string, unknown>;
  };

  assert.equal(requestBody.model, 'kling-3.0/video');
  assert.equal(requestBody.input.mode, 'std');
  assert.equal(requestBody.input.multi_shots, false);
  assert.equal(requestBody.input.prompt, 'Creator reveals the product in a clean close-up.');
});

test('Kling multi-shot request body includes multi_prompt and elements', () => {
  const requestBody = __test__.buildKlingVideoRequestBody({
    projectId: 'project-123',
    segmentIndex: 0,
    aspectRatio: '16:9',
    quality: '1080p',
    imageUrls: ['https://example.com/frame-1.png'],
    boundedDuration: 12,
    hasMultipleShots: true,
    multiPrompt: [
      { prompt: 'Shot one prompt', duration: 5 },
      { prompt: 'Shot two prompt', duration: 7 }
    ],
    prompt: '',
    elements: [{
      name: 'element_product',
      description: 'Product packshot',
      element_input_urls: ['https://example.com/product.png']
    }]
  }) as {
    input: Record<string, unknown>;
  };

  assert.equal(requestBody.input.mode, 'pro');
  assert.deepEqual(requestBody.input.multi_prompt, [
    { prompt: 'Shot one prompt', duration: 5 },
    { prompt: 'Shot two prompt', duration: 7 }
  ]);
  assert.deepEqual(requestBody.input.kling_elements, [{
    name: 'element_product',
    description: 'Product packshot',
    element_input_urls: ['https://example.com/product.png']
  }]);
});

test('single-shot Kling request body does not include multi_prompt', () => {
  const requestBody = __test__.buildKlingVideoRequestBody({
    projectId: 'project-123',
    segmentIndex: 0,
    aspectRatio: '16:9',
    quality: '720p',
    imageUrls: ['https://example.com/frame-1.png'],
    boundedDuration: 6,
    hasMultipleShots: false,
    multiPrompt: [{ prompt: 'Should not be used', duration: 6 }],
    prompt: 'One shot only.',
    elements: []
  }) as {
    input: Record<string, unknown>;
  };

  assert.equal(requestBody.input.multi_shots, false);
  assert.equal('multi_prompt' in requestBody.input, false);
  assert.equal(requestBody.input.prompt, 'One shot only.');
});

test('Kling request body rejects multi-shot scenes above the provider item limit', () => {
  assert.throws(
    () => __test__.buildKlingVideoRequestBody({
      projectId: 'project-123',
      segmentIndex: 0,
      aspectRatio: '16:9',
      quality: '720p',
      imageUrls: ['https://example.com/frame-1.png'],
      boundedDuration: 12,
      hasMultipleShots: true,
      multiPrompt: Array.from({ length: 7 }, (_, index) => ({
        prompt: `Shot ${index + 1}`,
        duration: 1,
      })),
      prompt: '',
      elements: []
    }),
    /at most 6 shots/i
  );
});

test('Kling element names stay within the 20 character API limit', () => {
  const name = __test__.buildKlingElementName(
    'Nutritional supplements1',
    'product:nutritional supplements1',
    new Set<string>()
  );

  assert.equal(name.length <= 20, true);
  assert.equal(name.startsWith('element_'), true);
});
