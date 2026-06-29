import type { VideoModel } from '@/lib/constants';

export const AVATAR_ADS_SEEDANCE_STORYBOARD_DURATION_SECONDS = 15;

export const isAvatarAdsSeedanceStoryboardModel = (
  model: unknown
): model is Extract<VideoModel, 'seedance_2_fast' | 'seedance_2' | 'seedance_2_mini'> => (
  model === 'seedance_2_fast' ||
  model === 'seedance_2' ||
  model === 'seedance_2_mini'
);

export const normalizeAvatarAdsStoryboardDurationSeconds = (
  model: unknown,
  durationSeconds: number
) => (
  isAvatarAdsSeedanceStoryboardModel(model)
    ? AVATAR_ADS_SEEDANCE_STORYBOARD_DURATION_SECONDS
    : durationSeconds
);
