import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAvatarAdsVideoExecutionPrompt,
  compileAvatarAdsMentionText,
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
    { hasProductContext: true }
  );

  assert.match(result, /Subject: spokesperson from the provided character image\./);
  assert.match(result, /Action: speak directly to camera/i);
  assert.match(result, /Style: authentic user-generated talking-head ad\./);
  assert.match(result, /Dialogue: "This is the easiest way to get clean energy every morning\."/i);
});

test('buildAvatarAdsVideoExecutionPrompt preserves explicit structured visual fields when present', () => {
  const result = buildAvatarAdsVideoExecutionPrompt({
    subject: 'Female creator in cream sweater',
    action: 'speaks directly to camera and smiles',
    dialog: 'I have been using this every day and the difference is obvious.',
  });

  assert.match(result, /Subject: Female creator in cream sweater/);
  assert.match(result, /Action: speaks directly to camera and smiles/);
  assert.doesNotMatch(result, /spokesperson from the provided character image/i);
});

test('buildAvatarAdsVideoExecutionPrompt keeps Chinese dialogue aligned with Chinese voice guidance', () => {
  const result = buildAvatarAdsVideoExecutionPrompt({
    subject: 'Male creator in a dark collared shirt',
    dialog: '这款草本清风包，清香淡雅不刺鼻，帮助舒缓身心、放松压力。',
    voice_type: 'English accent, warm male voice',
  }, {
    hasProductContext: true,
    language: 'en',
  });

  assert.match(result, /Dialogue: "这款草本清风包/);
  assert.match(result, /Voice Type: Warm male voice speaking natural Chinese/);
  assert.doesNotMatch(result, /English accent/i);
});
