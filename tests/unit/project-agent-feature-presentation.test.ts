import test from 'node:test';
import assert from 'node:assert/strict';
import { getFeatureNodePresentation } from '@/lib/project-agent/feature-node-presentation';

test('feature nodes expose semantic labels for title icon and model styling', () => {
  assert.deepEqual(getFeatureNodePresentation('video_clone'), {
    titleIcon: 'copy_plus',
    modelBarTone: 'dark',
    titleIconTone: 'inherit',
  });
  assert.deepEqual(getFeatureNodePresentation('avatar_ads'), {
    titleIcon: 'sparkles',
    modelBarTone: 'dark',
    titleIconTone: 'inherit',
  });
  assert.deepEqual(getFeatureNodePresentation('motion_clone'), {
    titleIcon: 'wand_sparkles',
    modelBarTone: 'dark',
    titleIconTone: 'inherit',
  });
});


test('video clone clone mode keeps Kling 3 available while edit mode excludes it', async () => {
  const { getProjectAgentVideoCloneAllowedModels } = await import('@/lib/project-agent/video-clone-mode');
  assert.deepEqual(getProjectAgentVideoCloneAllowedModels('clone'), ['seedance_2', 'seedance_2_fast', 'kling_3']);
  assert.deepEqual(getProjectAgentVideoCloneAllowedModels('edit_video'), ['seedance_2', 'seedance_2_fast', 'wan_27']);
});
