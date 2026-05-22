import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEcommerceListingFailureUpdate,
  buildWebhookJobUpdate,
  shouldCreateAdShortFilmVideoTask,
  shouldCreateEcommerceListingVideoTask,
} from '@/lib/tools/kie-webhook-state';

test('ad short film video success completes the parent job', () => {
  const update = buildWebhookJobUpdate({
    job: {
      tool_key: 'ad-short-film',
      metadata: { product_image_url: 'https://example.com/product.png' },
    },
    task: {
      metadata: { stage: 'video' },
    },
    resultUrl: 'https://example.com/final.mp4',
    webhookReceivedAt: '2026-05-22T00:00:00.000Z',
    siblingTasks: [],
  });

  assert.deepEqual(update, {
    status: 'completed',
    result_url: 'https://example.com/final.mp4',
    webhook_received_at: '2026-05-22T00:00:00.000Z',
    metadata: { product_image_url: 'https://example.com/product.png' },
  });
});

test('ad short film storyboard success stores storyboard image but does not complete job', () => {
  const update = buildWebhookJobUpdate({
    job: {
      tool_key: 'ad-short-film',
      metadata: { product_image_url: 'https://example.com/product.png' },
    },
    task: {
      metadata: { stage: 'storyboard_image' },
    },
    resultUrl: 'https://example.com/storyboard.png',
    webhookReceivedAt: '2026-05-22T00:00:00.000Z',
    siblingTasks: [],
  });

  assert.deepEqual(update, {
    status: 'generating_video',
    webhook_received_at: '2026-05-22T00:00:00.000Z',
    metadata: {
      product_image_url: 'https://example.com/product.png',
      storyboard_image_url: 'https://example.com/storyboard.png',
    },
  });
});

test('bulk image clone completes parent job only when all tasks are terminal', () => {
  const update = buildWebhookJobUpdate({
    job: {
      tool_key: 'image-clone-bulk',
      metadata: { row_count: 2 },
    },
    task: {
      metadata: { row_number: 1 },
    },
    resultUrl: 'https://example.com/row-1.png',
    webhookReceivedAt: '2026-05-22T00:00:00.000Z',
    siblingTasks: [
      { status: 'completed' },
      { status: 'completed' },
    ],
  });

  assert.deepEqual(update, {
    status: 'completed',
    webhook_received_at: '2026-05-22T00:00:00.000Z',
    metadata: { row_count: 2 },
  });
});

test('ad short film video task is created only once', () => {
  assert.equal(
    shouldCreateAdShortFilmVideoTask({
      taskMetadata: { stage: 'storyboard_image' },
      jobMetadata: { product_image_url: 'https://example.com/product.png' },
    }),
    true
  );
  assert.equal(
    shouldCreateAdShortFilmVideoTask({
      taskMetadata: { stage: 'storyboard_image' },
      jobMetadata: {
        product_image_url: 'https://example.com/product.png',
        video_task_id: 'existing-task',
      },
    }),
    false
  );
});

test('ecommerce listing image success updates matching slot without completing parent early', () => {
  const update = buildWebhookJobUpdate({
    job: {
      tool_key: 'ecommerce-listing-studio',
      metadata: {
        asset_scopes: ['carousel', 'video'],
        carousel_images: [
          { id: 'carousel-1', kind: 'carousel', index: 1, title: 'One', taskId: 't1', status: 'processing', prompt: 'p' },
        ],
        detail_images: [],
        video: { status: 'processing', prompt: 'v' },
        total_outputs: 2,
        completed_outputs: 0,
      },
    },
    task: {
      metadata: { stage: 'image', slot_id: 'carousel-1' },
    },
    resultUrl: 'https://example.com/carousel.png',
    webhookReceivedAt: '2026-05-22T00:00:00.000Z',
    siblingTasks: [],
  });

  assert.equal(update.status, undefined);
  assert.equal(update.webhook_received_at, '2026-05-22T00:00:00.000Z');
  assert.equal(update.metadata?.completed_outputs, 1);
  assert.equal(update.metadata?.total_outputs, 2);
  assert.equal((update.metadata?.carousel_images as Array<{ resultUrl?: string }>)[0].resultUrl, 'https://example.com/carousel.png');
});

test('ecommerce listing storyboard success starts video stage once', () => {
  const update = buildWebhookJobUpdate({
    job: {
      tool_key: 'ecommerce-listing-studio',
      metadata: {
        asset_scopes: ['video'],
        carousel_images: [],
        detail_images: [],
        video: { status: 'processing', prompt: 'video prompt' },
        total_outputs: 1,
        completed_outputs: 0,
      },
    },
    task: {
      metadata: { stage: 'storyboard_image' },
    },
    resultUrl: 'https://example.com/storyboard.png',
    webhookReceivedAt: '2026-05-22T00:00:00.000Z',
    siblingTasks: [],
  });

  assert.equal(update.status, 'generating_video');
  assert.equal((update.metadata?.video as { storyboardUrl?: string }).storyboardUrl, 'https://example.com/storyboard.png');
  assert.equal(
    shouldCreateEcommerceListingVideoTask({
      taskMetadata: { stage: 'storyboard_image' },
      jobMetadata: update.metadata,
    }),
    true
  );
  assert.equal(
    shouldCreateEcommerceListingVideoTask({
      taskMetadata: { stage: 'storyboard_image' },
      jobMetadata: { ...update.metadata, video: { ...(update.metadata?.video as object), taskId: 'existing' } },
    }),
    false
  );
});

test('ecommerce listing video success completes video-only parent job', () => {
  const update = buildWebhookJobUpdate({
    job: {
      tool_key: 'ecommerce-listing-studio',
      metadata: {
        asset_scopes: ['video'],
        carousel_images: [],
        detail_images: [],
        video: { status: 'processing', prompt: 'video prompt', storyboardUrl: 'https://example.com/storyboard.png', taskId: 'video-task' },
        total_outputs: 1,
        completed_outputs: 0,
      },
    },
    task: {
      metadata: { stage: 'video' },
    },
    resultUrl: 'https://example.com/video.mp4',
    webhookReceivedAt: '2026-05-22T00:00:00.000Z',
    siblingTasks: [],
  });

  assert.equal(update.status, 'completed');
  assert.equal(update.result_url, 'https://example.com/video.mp4');
  assert.equal(update.metadata?.completed_outputs, 1);
});

test('ecommerce listing failure update marks failed slot and parent', () => {
  const update = buildEcommerceListingFailureUpdate({
    job: {
      tool_key: 'ecommerce-listing-studio',
      metadata: {
        asset_scopes: ['detail'],
        carousel_images: [],
        detail_images: [
          { id: 'detail-1', kind: 'detail', index: 1, title: 'One', taskId: 't1', status: 'processing', prompt: 'p' },
        ],
      },
    },
    task: {
      metadata: { stage: 'image', slot_id: 'detail-1' },
    },
    errorMessage: 'provider failed',
    webhookReceivedAt: '2026-05-22T00:00:00.000Z',
  });

  assert.equal(update?.status, 'failed');
  assert.equal(update?.error_message, 'provider failed');
  assert.equal((update?.metadata?.detail_images as Array<{ status?: string; error?: string }>)[0].status, 'fail');
  assert.equal((update?.metadata?.detail_images as Array<{ status?: string; error?: string }>)[0].error, 'provider failed');
});
