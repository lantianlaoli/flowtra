import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAvatarAdsStartPayload } from '@/lib/project-agent/node-execution';
import {
  AVATAR_ADS_SEEDANCE_STORYBOARD_DURATION_SECONDS,
  isAvatarAdsSeedanceStoryboardModel,
  buildSeedanceAvatarAdsVideoInput,
  __test__ as avatarAdsWorkflowTest,
} from '@/lib/avatar-ads-workflow';

test('Avatar Ads product instruction is guidance, not custom dialogue', () => {
  const payload = buildAvatarAdsStartPayload({
    avatar: {
      id: 'avatar-1',
      name: 'Creator',
      imageUrl: 'https://example.com/avatar.png',
    },
    product: {
      id: 'product-1',
      name: 'Tuna Can',
      imageUrl: 'https://example.com/product.png',
    },
    text: {
      id: 'text-1',
      name: 'Instruction',
      content: 'Explain high protein and easy-open lid first.',
    },
    config: {
      videoModel: 'seedance_2_mini',
      videoQuality: '480p',
      videoDuration: '16',
      aspectRatio: '9:16',
    },
  });

  assert.equal(payload.customDialogue, '');
  assert.equal(payload.sellingRequirements, 'Explain high protein and easy-open lid first.');
  assert.equal(payload.talkingHeadMode, false);
  assert.equal(payload.videoDurationSeconds, AVATAR_ADS_SEEDANCE_STORYBOARD_DURATION_SECONDS);
});

test('Avatar Ads talking-head text remains custom dialogue', () => {
  const payload = buildAvatarAdsStartPayload({
    avatar: {
      id: 'avatar-1',
      name: 'Creator',
      imageUrl: 'https://example.com/avatar.png',
    },
    text: {
      id: 'text-1',
      name: 'Script',
      content: 'Read this exact talking-head script.',
    },
    config: {
      videoModel: 'kling_3',
      videoQuality: '720p',
      videoDuration: '16',
      aspectRatio: '9:16',
    },
  });

  assert.equal(payload.customDialogue, 'Read this exact talking-head script.');
  assert.equal(payload.sellingRequirements, '');
  assert.equal(payload.talkingHeadMode, true);
});

test('Avatar Ads Seedance storyboard metadata includes selling requirements', () => {
  const prompts = avatarAdsWorkflowTest.buildAvatarAdsStoryboardMode({
    prompts: {
      scenes: [
        {
          scene: 1,
          prompt: {
            subject: 'Creator holds the product.',
            action: [{ time: '0-4s', description: 'Show the lid and smile.' }],
            camera_motion_positioning: 'Handheld medium close-up.',
            audio: 'Soft upbeat music.',
            dialog: { '0-4s': 'This is easy to open and packed with protein.' },
            duration_seconds: 8,
          },
        },
      ],
    },
    model: 'seedance_2_mini',
    videoDurationSeconds: 8,
    avatarName: 'Creator',
    productName: 'Tuna Can',
    sellingRequirements: 'Lead with easy-open lid, then protein.',
  });

  assert.equal(typeof prompts.image_prompt, 'string');
  assert.match(String(prompts.image_prompt), /product-first usage scenario storyboard sheet/);
  assert.match(String(prompts.image_prompt), /Do not copy the avatar reference photo background/);
  assert.match(String(prompts.image_prompt), /product being used/);
  assert.match(String(prompts.image_prompt), /Lead with easy-open lid/);
  assert.deepEqual((prompts.storyboard_mode as { rows: unknown[] }).rows.length, 1);
  assert.equal(prompts.planned_total_duration_seconds, AVATAR_ADS_SEEDANCE_STORYBOARD_DURATION_SECONDS);
  assert.deepEqual(prompts.planned_scene_duration_seconds, [AVATAR_ADS_SEEDANCE_STORYBOARD_DURATION_SECONDS]);
  assert.equal(
    (prompts.scenes as Array<{ prompt: { duration_seconds: number } }>)[0].prompt.duration_seconds,
    AVATAR_ADS_SEEDANCE_STORYBOARD_DURATION_SECONDS
  );
  const [row] = (prompts.storyboard_mode as { rows: Array<Record<string, unknown>> }).rows;
  assert.equal(row.duration_seconds, AVATAR_ADS_SEEDANCE_STORYBOARD_DURATION_SECONDS);
  assert.match(String(row.product_usage_beat), /Show the lid and smile/);
  assert.match(String(row.selling_point), /Lead with easy-open lid/);
});

test('Avatar Ads Seedance storyboard mode applies to every Seedance 2 model', () => {
  assert.equal(isAvatarAdsSeedanceStoryboardModel('seedance_2_fast'), true);
  assert.equal(isAvatarAdsSeedanceStoryboardModel('seedance_2'), true);
  assert.equal(isAvatarAdsSeedanceStoryboardModel('seedance_2_mini'), true);
  assert.equal(isAvatarAdsSeedanceStoryboardModel('kling_3'), false);
  assert.equal(isAvatarAdsSeedanceStoryboardModel('wan_27'), false);
});

test('Avatar Ads storyboard image is the only Seedance reference image', () => {
  const urls = avatarAdsWorkflowTest.getAvatarAdsVideoReferenceImageUrls({
    generated_image_url: 'https://example.com/storyboard.png',
    person_image_urls: ['https://example.com/avatar.png'],
    product_image_urls: ['https://example.com/product.png'],
    generated_prompts: {
      storyboard_mode: {
        storyboard_image_url: 'https://example.com/storyboard.png',
      },
    },
  });

  assert.deepEqual(urls, ['https://example.com/storyboard.png']);

  const input = buildSeedanceAvatarAdsVideoInput({
    prompt: 'Follow row 1 exactly.',
    referenceImageUrls: urls,
    durationSeconds: 8,
    model: 'seedance_2_mini',
    resolution: '480p',
  });

  assert.deepEqual(input.reference_image_urls, urls);
  assert.equal(input.duration, AVATAR_ADS_SEEDANCE_STORYBOARD_DURATION_SECONDS);
  assert.equal(input.resolution, '480p');
});

test('Avatar Ads Seedance storyboard video prompt only asks to follow the storyboard row', () => {
  const prompt = avatarAdsWorkflowTest.buildAvatarAdsSeedanceStoryboardVideoPrompt({
    sceneNumber: 1,
    finalPrompt: [
      'Spoken Language: English',
      '',
      '{"subject":"Young Asian male holding product","action":[{"description":"Rotate can and thumbs up"}]}',
    ].join('\n'),
  });

  assert.match(prompt, /Use reference_image_urls\[0\] as the storyboard sheet/);
  assert.match(prompt, /Follow storyboard row 1 exactly/);
  assert.match(prompt, /same order, framing, camera movement, action timing, and dialogue timing/);
  assert.doesNotMatch(prompt, /Young Asian male/);
  assert.doesNotMatch(prompt, /Rotate can and thumbs up/);
  assert.doesNotMatch(prompt, /"subject"/);
});
