import test from 'node:test';
import assert from 'node:assert/strict';

import {
  refineCanvasIntent,
  normalizeCanvasIntent,
  normalizeCanvasReplyLanguage,
} from '@/lib/project-agent/canvas-intent';

test('normalizes semantic motion clone intent with named video and chinese reply language', () => {
  const intent = normalizeCanvasIntent({
    raw: {
      workflow: 'motion_clone',
      operation: 'build_workflow',
      assetRefs: [
        { type: 'video', value: 'brush-1', mode: 'named' },
      ],
      constraints: {
        keepProduct: true,
      },
      executionMode: 'build_only',
      replyLanguage: 'zh-CN',
      nextRequiredSelection: 'avatar',
      confidence: 0.91,
    },
    rawUserRequest: '请用 brush-1 创建 motion clone 工作流',
    fallbackLanguage: 'en',
  });

  assert.ok(intent);
  assert.equal(intent?.workflow, 'motion_clone');
  assert.equal(intent?.operation, 'build_workflow');
  assert.equal(intent?.assetRefs[0]?.type, 'video');
  assert.equal(intent?.assetRefs[0]?.value, 'brush-1');
  assert.equal(intent?.replyLanguage, 'zh');
  assert.equal(intent?.nextRequiredSelection, 'avatar');
  assert.equal(intent?.constraints.keepProduct, true);
});

test('normalizes current-context asset references', () => {
  const intent = normalizeCanvasIntent({
    raw: {
      workflow: 'motion_clone',
      operation: 'build_workflow',
      assetRefs: [
        { type: 'video', mode: 'current_context' },
        { type: 'avatar', mode: 'current_context' },
      ],
      executionMode: 'build_only',
      replyLanguage: 'same_as_user',
      confidence: 0.8,
    },
    rawUserRequest: 'Use the same video and avatar for motion clone',
    fallbackLanguage: 'en',
  });

  assert.ok(intent);
  assert.equal(intent?.assetRefs[0]?.mode, 'current_context');
  assert.equal(intent?.assetRefs[1]?.mode, 'current_context');
  assert.equal(intent?.replyLanguage, 'en');
});

test('normalizes reply language aliases', () => {
  assert.equal(normalizeCanvasReplyLanguage('zh-CN', 'en'), 'zh');
  assert.equal(normalizeCanvasReplyLanguage('EN-us', 'zh'), 'en');
  assert.equal(normalizeCanvasReplyLanguage('same_as_user', 'ja'), 'ja');
});

test('normalizes multilingual video clone intent with current-context product reuse', () => {
  const intent = normalizeCanvasIntent({
    raw: {
      workflow: 'video_clone',
      operation: 'build_workflow',
      assetRefs: [
        { type: 'video', value: 'Health Supplements 1', mode: 'named' },
        { type: 'product', mode: 'current_context' },
      ],
      constraints: {
        keepProduct: true,
        removeAvatar: true,
      },
      executionMode: 'build_only',
      replyLanguage: 'zh-Hans',
      confidence: 0.88,
    },
    rawUserRequest: '请用 Health Supplements 1，继续用当前产品来创建 video clone，不要加 avatar。',
    fallbackLanguage: 'en',
  });

  assert.ok(intent);
  assert.equal(intent?.workflow, 'video_clone');
  assert.equal(intent?.assetRefs[0]?.value, 'Health Supplements 1');
  assert.equal(intent?.assetRefs[1]?.mode, 'current_context');
  assert.equal(intent?.constraints.keepProduct, true);
  assert.equal(intent?.constraints.removeAvatar, true);
  assert.equal(intent?.replyLanguage, 'zh');
});

test('normalizes avatar ads intent with named avatar and product plus explicit execution mode', () => {
  const intent = normalizeCanvasIntent({
    raw: {
      workflow: 'avatar_ads',
      operation: 'execute_workflow',
      assetRefs: [
        { type: 'avatar', value: 'Default Female', mode: 'named' },
        { type: 'product', value: 'diet-1', mode: 'named' },
      ],
      constraints: {
        avoidWorkflow: 'motion_clone',
      },
      executionMode: 'execute',
      replyLanguage: 'en-US',
      nextRequiredSelection: null,
      confidence: 0.94,
    },
    rawUserRequest: 'Use Default Female to pitch diet-1, then start avatar ads.',
    fallbackLanguage: 'zh',
  });

  assert.ok(intent);
  assert.equal(intent?.workflow, 'avatar_ads');
  assert.equal(intent?.operation, 'execute_workflow');
  assert.equal(intent?.executionMode, 'execute');
  assert.equal(intent?.constraints.avoidWorkflow, 'motion_clone');
  assert.equal(intent?.assetRefs.length, 2);
  assert.equal(intent?.replyLanguage, 'en');
});

test('refineCanvasIntent remaps generic clone with video and product from motion clone to video clone', () => {
  const refined = refineCanvasIntent({
    workflow: 'motion_clone',
    operation: 'build_workflow',
    assetRefs: [
      { type: 'video', value: 'Decorations 1', mode: 'named' },
      { type: 'product', value: 'red lapel pin', mode: 'named' },
    ],
    constraints: {},
    executionMode: 'build_only',
    replyLanguage: 'en',
    nextRequiredSelection: null,
    confidence: 0.81,
    rawUserRequest: 'I want to clone Decorations 1 for red lapel pin.',
  });

  assert.equal(refined.workflow, 'video_clone');
});

test('refineCanvasIntent keeps explicit motion clone requests as motion clone', () => {
  const refined = refineCanvasIntent({
    workflow: 'motion_clone',
    operation: 'build_workflow',
    assetRefs: [
      { type: 'video', value: 'Decorations 1', mode: 'named' },
      { type: 'avatar', value: 'Default Male', mode: 'named' },
      { type: 'product', value: 'red lapel pin', mode: 'named' },
    ],
    constraints: {},
    executionMode: 'build_only',
    replyLanguage: 'en',
    nextRequiredSelection: null,
    confidence: 0.92,
    rawUserRequest: 'Set up motion clone with Default Male, red lapel pin, and Decorations 1.',
  });

  assert.equal(refined.workflow, 'motion_clone');
});
