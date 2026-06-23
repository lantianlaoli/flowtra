import type { VideoModel } from '@/lib/constants';

type VideoModelDisplayContext = {
  feature?: 'avatar_ads' | 'video_clone' | 'motion_clone';
};

export const getVideoModelDisplayName = (
  model: VideoModel | string,
  context?: VideoModelDisplayContext
) => {
  if (model === 'kling_3' && context?.feature === 'motion_clone') {
    return 'Kling 3.0 Motion Control';
  }

  switch (model) {
    case 'seedance_2_fast':
      return 'Seedance 2 Fast';
    case 'seedance_2':
      return 'Seedance 2';
    case 'seedance_2_mini':
      return 'Seedance 2 Mini';
    case 'kling_3':
      return 'Kling 3.0';
    default:
      return model;
  }
};
