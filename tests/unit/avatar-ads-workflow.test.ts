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
