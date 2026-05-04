import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__ } from '@/lib/video-clone-workflow';

test('project agent frame prompt uses image prompt as primary source', () => {
  const prompt = __test__.buildProjectAgentFramePrompt({
    segmentIndex: 0,
    frameType: 'first',
    frameDescription: 'A close-up of a hand holding the massager in a bedroom.',
    isBrandShot: false
  });

  assert.match(prompt, /Description: A close-up of a hand holding the massager in a bedroom\./);
  assert.doesNotMatch(prompt, /Lighting:/);
  assert.doesNotMatch(prompt, /Camera:/);
  assert.doesNotMatch(prompt, /Setting:/);
});

test('cleanSegmentText removes orphan possessive fragments', () => {
  assert.equal(
    __test__.cleanSegmentText("A close-up of 's hand holding the device."),
    'A close-up of hand holding the device.'
  );
});

test('continuation scenes wait for previous first frame before starting', () => {
  assert.equal(
    __test__.shouldWaitForContinuationFrame({
      segmentIndex: 1,
      isContinuationFromPrev: true
    }),
    true
  );
  assert.equal(
    __test__.shouldWaitForContinuationFrame({
      segmentIndex: 1,
      isContinuationFromPrev: false
    }),
    false
  );
  assert.equal(
    __test__.shouldWaitForContinuationFrame({
      segmentIndex: 0,
      isContinuationFromPrev: true
    }),
    false
  );
});

test('project agent Seedance mode skips first-frame generation gate', () => {
  assert.equal(
    __test__.isProjectAgentSeedanceReferenceImageMode({
      requestSource: 'project_agent_clone',
      videoModel: 'seedance_2_fast'
    }),
    true
  );
  assert.equal(
    __test__.isProjectAgentSeedanceReferenceImageMode({
      requestSource: 'project_agent_clone',
      videoModel: 'kling_3'
    }),
    false
  );
});

test('Seedance reference-image request body does not mix first or last frame inputs', () => {
  const requestBody = __test__.buildSeedanceVideoRequestBody({
    projectId: 'project-1',
    segmentIndex: 0,
    model: 'seedance_2_fast',
    prompt: 'A creator demonstrates the product in the same rhythm as the reference video.',
    inputUrls: ['https://example.com/first.png', 'https://example.com/last.png'],
    referenceImageUrls: ['https://example.com/avatar.png', 'https://example.com/product.png'],
    aspectRatio: '9:16',
    resolution: '720p',
    duration: 15
  });

  const input = requestBody.input as Record<string, unknown>;
  assert.equal(requestBody.model, 'bytedance/seedance-2-fast');
  assert.deepEqual(input.reference_image_urls, [
    'https://example.com/avatar.png',
    'https://example.com/product.png'
  ]);
  assert.equal(input.aspect_ratio, '9:16');
  assert.equal(input.resolution, '720p');
  assert.equal(input.duration, 15);
  assert.equal(input.generate_audio, true);
  assert.equal(input.web_search, false);
  assert.equal('input_urls' in input, false);
  assert.equal('first_frame_url' in input, false);
  assert.equal('last_frame_url' in input, false);
});

test('Seedance image-conditioned request disables web search for KIE compatibility', () => {
  const requestBody = __test__.buildSeedanceVideoRequestBody({
    projectId: 'project-1',
    segmentIndex: 0,
    model: 'seedance_2_fast',
    prompt: 'Animate this product photo into a short creator-style ad.',
    inputUrls: ['https://example.com/first.png'],
    referenceImageUrls: [],
    aspectRatio: '9:16',
    resolution: '720p',
    duration: 8
  });

  const input = requestBody.input as Record<string, unknown>;
  assert.equal(input.web_search, false);
  assert.deepEqual(input.input_urls, ['https://example.com/first.png']);
});

test('Seedance text-only request is the only mode that enables web search', () => {
  const requestBody = __test__.buildSeedanceVideoRequestBody({
    projectId: 'project-1',
    segmentIndex: 0,
    model: 'seedance_2_fast',
    prompt: 'Create a short video about current consumer trends.',
    inputUrls: [],
    referenceImageUrls: [],
    aspectRatio: '16:9',
    resolution: '720p',
    duration: 5
  });

  const input = requestBody.input as Record<string, unknown>;
  assert.equal(input.web_search, true);
  assert.equal('reference_image_urls' in input, false);
  assert.equal('input_urls' in input, false);
  assert.equal('fixed_lens' in input, false);
});

test('Seedance reference-image request matches KIE multimodal reference constraints', () => {
  const requestBody = __test__.buildSeedanceVideoRequestBody({
    projectId: 'project-1',
    segmentIndex: 0,
    model: 'seedance_2_fast',
    prompt: 'Use the attached creator and product images as references for a vertical UGC ad.',
    inputUrls: ['https://example.com/ignored-first.png'],
    referenceImageUrls: Array.from({ length: 12 }, (_, index) => `https://example.com/ref-${index}.png`),
    aspectRatio: '9:16',
    resolution: '720p',
    duration: 12
  });

  const input = requestBody.input as Record<string, unknown>;
  assert.equal(requestBody.callBackUrl, 'https://flowtra.ai/api/video-clone/webhooks/video?projectId=project-1&segmentIndex=0');
  assert.equal(input.web_search, false);
  assert.equal(input.generate_audio, true);
  assert.equal(input.resolution, '720p');
  assert.equal(input.aspect_ratio, '9:16');
  assert.equal(input.duration, 12);
  assert.equal((input.reference_image_urls as string[]).length, 9);
  assert.equal('input_urls' in input, false);
  assert.equal('first_frame_url' in input, false);
  assert.equal('last_frame_url' in input, false);
  assert.equal('fixed_lens' in input, false);
});

test('project agent clone projects are not marked charged at create time', async () => {
  const source = await import('node:fs/promises')
    .then((fs) => fs.readFile('lib/video-clone-workflow.ts', 'utf8'));

  assert.match(
    source,
    /generation_credits_used: isReferenceCloneCreate \|\| request\.requestSource === 'project_agent_clone'/
  );
});

test('project agent Seedance reference images are collected from clone assets', () => {
  const urls = __test__.getProjectAgentSeedanceReferenceImageUrls({
    video_model: 'seedance_2_fast',
    selected_inputs: { workflowSource: 'project_agent_clone' },
    video_prompts: {
      clone_reference_assets: {
        avatarPhotoUrls: ['https://example.com/avatar.png'],
        productImageUrls: ['https://example.com/product.png', 'https://example.com/avatar.png']
      }
    }
  });

  assert.deepEqual(urls, [
    'https://example.com/avatar.png',
    'https://example.com/product.png'
  ]);
});

test('structured video prompt payload keeps only shot content', () => {
  const payload = __test__.buildStructuredVideoPromptPayload({
    normalizedShots: [{
      time_range: '00:00 - 00:06',
      subject: 'Default Male in frame',
      context_environment: 'Bathroom interior',
      action: 'Continues the massaging motion',
      style: 'Vertical video, close-up detail shot',
      camera_motion_positioning: 'Static framing',
      composition: 'Tight focus on the device and skin',
      ambiance_colour_lighting: 'Bright bathroom lighting',
      audio: 'Low mechanical hum',
      dialogue: '',
      language: 'en'
    }]
  });

  assert.deepEqual(Object.keys(payload), ['shots']);
  assert.equal(payload.shots.length, 1);
  assert.equal(payload.shots[0].action, 'Continues the massaging motion');
});

test('Kling prompt scene duration follows the scene shot time range end', () => {
  assert.equal(
    __test__.getPromptSegmentDurationSeconds({
      shots: [
        {
          time_range: '00:00 - 00:03'
        },
        {
          time_range: '00:03 - 00:11'
        }
      ]
    }),
    11
  );
});

test('Kling multi-shot durations preserve explicit workspace shot timing', () => {
  assert.deepEqual(
    __test__.deriveKlingShotDurationsFromSourceShots(
      [
        {
          time_range: '00:00 - 00:03',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        },
        {
          time_range: '00:03 - 00:06',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        },
        {
          time_range: '00:06 - 00:09',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        },
        {
          time_range: '00:09 - 00:11',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        },
        {
          time_range: '00:11 - 00:13',
          subject: '',
          context_environment: '',
          action: '',
          style: '',
          camera_motion_positioning: '',
          composition: '',
          ambiance_colour_lighting: '',
          audio: '',
          dialogue: '',
          language: 'en'
        }
      ],
      5,
      13
    ),
    [3, 3, 3, 2, 2]
  );
});
