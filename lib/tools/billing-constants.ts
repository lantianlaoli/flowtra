import { GENERATION_COSTS, SEEDANCE_2_FAST_QUALITY_COSTS, SEEDANCE_2_QUALITY_COSTS } from '@/lib/constants';

export const IMAGE_GENERATION_CREDIT_COST = 3;
export const AD_SHORT_FILM_DURATION_SECONDS = 15;
export const AD_SHORT_FILM_VIDEO_CREDIT_COST =
  AD_SHORT_FILM_DURATION_SECONDS * GENERATION_COSTS.seedance_2_fast;
export const AD_SHORT_FILM_TOTAL_CREDIT_COST =
  IMAGE_GENERATION_CREDIT_COST + AD_SHORT_FILM_VIDEO_CREDIT_COST;
export const ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS = 15;
export const ECOMMERCE_LISTING_VIDEO_CREDIT_COST =
  ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS * GENERATION_COSTS.seedance_2_fast;
export const ECOMMERCE_LISTING_STORYBOARD_CREDIT_COST = IMAGE_GENERATION_CREDIT_COST;

export function getImageGenerationCreditCost(count: number) {
  return Math.max(0, Math.floor(count)) * IMAGE_GENERATION_CREDIT_COST;
}

export function getEcommerceListingStudioCreditCost(params: {
  carousel?: boolean;
  detail?: boolean;
  video?: boolean;
  videoModel?: 'seedance_2_fast' | 'seedance_2';
  videoResolution?: '480p' | '720p' | '1080p';
}) {
  const imageCount = (params.carousel ? 6 : 0) + (params.detail ? 6 : 0);
  const videoPerSecondCost = params.videoModel === 'seedance_2'
    ? SEEDANCE_2_QUALITY_COSTS[params.videoResolution === '480p' || params.videoResolution === '1080p' ? params.videoResolution : '720p']
    : SEEDANCE_2_FAST_QUALITY_COSTS[params.videoResolution === '480p' ? '480p' : '720p'];
  return (
    getImageGenerationCreditCost(imageCount) +
    (params.video
      ? ECOMMERCE_LISTING_STORYBOARD_CREDIT_COST +
        Math.ceil(ECOMMERCE_LISTING_VIDEO_DURATION_SECONDS * videoPerSecondCost)
      : 0)
  );
}
