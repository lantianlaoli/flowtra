import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWorkspaceScenes } from '@/lib/project-agent/workspace-scenes';

test('prefers draft editable fields while preserving execution runtime metadata', () => {
  const scenes = buildWorkspaceScenes({
    fallbackLanguage: 'en',
    draftScenes: [{
      sceneIndex: 1,
      imagePrompt: 'draft image prompt',
      sourceSummary: 'draft summary',
      videoPrompt: {
        shots: [{
          id: 1,
          time_range: '00:00 - 00:08',
          subject: 'draft subject',
          action: 'draft action',
          context_environment: 'draft context',
          sfx: 'draft click',
          ambient: 'draft room tone'
        }]
      }
    }],
    executionSegments: [{
      segmentIndex: 0,
      status: 'video_ready',
      firstFrameUrl: 'https://cdn.example/frame.png',
      videoUrl: 'https://cdn.example/video.mp4',
      prompt: {
        first_frame_description: 'segment image prompt',
        shots: [{
          id: 1,
          time_range: '00:00 - 00:08',
          subject: 'segment subject',
          action: 'segment action',
          context_environment: 'segment context',
          sfx: 'segment click',
          ambient: 'segment room tone'
        }]
      }
    }]
  });

  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].imagePrompt, 'draft image prompt');
  assert.equal(scenes[0].shots[0].subject, 'draft subject');
  assert.equal(scenes[0].shots[0].action, 'draft action');
  assert.equal(scenes[0].shots[0].sfx, 'draft click');
  assert.equal(scenes[0].shots[0].ambient, 'draft room tone');
  assert.equal(scenes[0].shots[0].audio, 'SFX: draft click | Ambient: draft room tone');
  assert.equal(scenes[0].frameUrl, 'https://cdn.example/frame.png');
  assert.equal(scenes[0].videoUrl, 'https://cdn.example/video.mp4');
});

test('falls back to execution prompt when no draft scene exists', () => {
  const scenes = buildWorkspaceScenes({
    fallbackLanguage: 'en',
    draftScenes: [],
    executionSegments: [{
      segmentIndex: 1,
      status: 'generating_video',
      prompt: {
        first_frame_description: 'segment-only image prompt',
        shots: [{
          id: 1,
          subject: 'segment-only subject'
        }]
      }
    }]
  });

  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].sceneIndex, 2);
  assert.equal(scenes[0].imagePrompt, 'segment-only image prompt');
  assert.equal(scenes[0].shots[0].subject, 'segment-only subject');
});
