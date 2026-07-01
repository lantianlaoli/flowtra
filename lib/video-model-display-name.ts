import type { VideoModel } from '@/lib/constants';

type VideoModelDisplayContext = {
  feature?: 'avatar_ads' | 'video_clone' | 'motion_clone';
};

export const getVideoModelDisplayName = (
  model: VideoModel | string,
  context?: VideoModelDisplayContext
) => {
  switch (model) {
    case 'seedance_2_fast':
      return 'Seedance 2 Fast';
    case 'seedance_2':
      return 'Seedance 2';
    case 'seedance_2_mini':
      return 'Seedance 2 Mini';
    default:
      return context?.feature === 'motion_clone' ? 'Legacy Motion Clone' : 'Legacy Model';
  }
};
