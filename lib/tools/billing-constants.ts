import { GENERATION_COSTS } from '@/lib/constants';

export const IMAGE_GENERATION_CREDIT_COST = 3;
export const AD_SHORT_FILM_DURATION_SECONDS = 15;
export const AD_SHORT_FILM_VIDEO_CREDIT_COST =
  AD_SHORT_FILM_DURATION_SECONDS * GENERATION_COSTS.seedance_2_fast;
export const AD_SHORT_FILM_TOTAL_CREDIT_COST =
  IMAGE_GENERATION_CREDIT_COST + AD_SHORT_FILM_VIDEO_CREDIT_COST;

export function getImageGenerationCreditCost(count: number) {
  return Math.max(0, Math.floor(count)) * IMAGE_GENERATION_CREDIT_COST;
}
