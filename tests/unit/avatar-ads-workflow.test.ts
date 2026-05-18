import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AVATAR_AGENT_REFERENCE_WORKFLOW_SOURCE,
  buildAvatarAdsVideoExecutionPrompt,
  buildWanAvatarAdsVideoInput,
  buildSeedanceAvatarAdsVideoInput,
  compileAvatarAdsMentionText,
  getAvatarAdsReferenceImageUrls,
  markAvatarPromptsForAgentReferenceWorkflow,
} from '@/lib/avatar-ads-workflow';

test('compileAvatarAdsMentionText removes mention token syntax for execution', () => {
  assert.equal(
    compileAvatarAdsMentionText('Show @default_female holding @protein_powder to camera.'),
    'Show default female holding protein powder to camera.'
  );
});

test('buildAvatarAdsVideoExecutionPrompt synthesizes fixed talking-head visuals for dialogue-only scenes', () => {
  const result = buildAvatarAdsVideoExecutionPrompt(
    {
      dialog: 'This is the easiest way to get clean energy every morning.'
    },
    { hasProductContext: true, durationSeconds: 8 }
  );

  assert.match(result, /"dialog": \{/);
  assert.match(result, /This is the easiest way to get clean energy every morning\./i);
});

test('buildAvatarAdsVideoExecutionPrompt preserves explicit structured visual fields when present', () => {
  const result = buildAvatarAdsVideoExecutionPrompt({
    subject: 'Female creator in cream sweater',
    action: 'speaks directly to camera and smiles',
    dialog: 'I have been using this every day and the difference is obvious.',
  }, { durationSeconds: 8 });

  assert.match(result, /"subject": "Female creator in cream sweater"/);
  assert.match(result, /speaks directly to camera and smiles/);
});

test('buildAvatarAdsVideoExecutionPrompt keeps Chinese dialogue aligned with Chinese voice guidance', () => {
  const result = buildAvatarAdsVideoExecutionPrompt({
    subject: 'Male creator in a dark collared shirt',
    dialog: '这款草本清风包，清香淡雅不刺鼻，帮助舒缓身心、放松压力。',
    voice_type: 'English accent, warm male voice',
  }, {
    hasProductContext: true,
    language: 'en',
    durationSeconds: 8,
  });

  assert.match(result, /这款草本清风包/);
  assert.match(result, /"language": "English"/);
  assert.doesNotMatch(result, /English accent/i);
});

test('buildAvatarAdsVideoExecutionPrompt keeps scenes in one product-led visual world', () => {
  const result = buildAvatarAdsVideoExecutionPrompt({
    subject: 'Female creator holding a serum bottle',
    context_environment: 'bright bathroom vanity',
    action: 'speaks to camera',
    dialog: 'This is the one step I never skip.',
  }, {
    hasProductContext: true,
    durationSeconds: 8,
  });

  assert.match(result, /infer the background and scene details from the product identity/i);
  assert.match(result, /same overall visual world and environment across every scene/i);
});

test('buildSeedanceAvatarAdsVideoInput uses multimodal reference images instead of frame endpoints', () => {
  const input = buildSeedanceAvatarAdsVideoInput({
    prompt: 'Speak to camera about the product.',
    referenceImageUrls: [
      'https://example.com/avatar.png',
      'https://example.com/product.png',
    ],
    durationSeconds: 15,
  });

  assert.deepEqual(input.reference_image_urls, [
    'https://example.com/avatar.png',
    'https://example.com/product.png',
  ]);
  assert.equal('first_frame_url' in input, false);
  assert.equal('last_frame_url' in input, false);
});

test('markAvatarPromptsForAgentReferenceWorkflow stores a durable dashboard workflow marker', () => {
  const prompts = markAvatarPromptsForAgentReferenceWorkflow({
    scenes: [{ prompt: { dialog: 'Hello.' } }],
  });

  assert.equal(prompts.workflow_source, AVATAR_AGENT_REFERENCE_WORKFLOW_SOURCE);
});

test('getAvatarAdsReferenceImageUrls uses person and product refs for product ads', () => {
  assert.deepEqual(
    getAvatarAdsReferenceImageUrls({
      person_image_urls: ['https://example.com/person.png'],
      product_image_urls: ['https://example.com/product-1.png', 'https://example.com/product-2.png'],
    }),
    [
      'https://example.com/person.png',
      'https://example.com/product-1.png',
      'https://example.com/product-2.png',
    ]
  );
});

test('getAvatarAdsReferenceImageUrls uses only person refs for talking head ads', () => {
  assert.deepEqual(
    getAvatarAdsReferenceImageUrls({
      person_image_urls: ['https://example.com/person.png'],
      product_image_urls: [],
    }),
    ['https://example.com/person.png']
  );
});

test('buildWanAvatarAdsVideoInput uses reference-to-video inputs for Agent avatar ads', () => {
  const input = buildWanAvatarAdsVideoInput({
    prompt: 'Speak to camera about the product.',
    referenceImageUrls: [
      'https://example.com/avatar.png',
      'https://example.com/product.png',
    ],
    durationSeconds: 8,
    resolution: '720p',
    aspectRatio: '9:16',
  });

  assert.deepEqual(input.reference_image, [
    'https://example.com/avatar.png',
    'https://example.com/product.png',
  ]);
  assert.equal(input.resolution, '720p');
  assert.equal(input.aspect_ratio, '9:16');
  assert.equal('first_frame_url' in input, false);
});
