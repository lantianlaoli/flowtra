export type FeatureInterestOption =
  | 'ai_agent'
  | 'avatar_ads'
  | 'video_clone'
  | 'motion_clone'
  | 'other';

export type FeatureInterestOptionConfig = {
  value: FeatureInterestOption;
  label: string;
  isNew?: boolean;
};

export const FEATURE_INTEREST_OPTIONS: FeatureInterestOptionConfig[] = [
  { value: 'ai_agent', label: 'AI Agent', isNew: true },
  { value: 'avatar_ads', label: 'Avatar Ads' },
  { value: 'video_clone', label: 'Video Clone' },
  { value: 'motion_clone', label: 'Motion Clone' },
  { value: 'other', label: 'Other' },
];

export const FEATURE_INTEREST_ALLOWED_VALUES = new Set(
  FEATURE_INTEREST_OPTIONS.map((option) => option.value)
);

export function getFeatureInterestOption(
  feature: FeatureInterestOption
): FeatureInterestOptionConfig | undefined {
  return FEATURE_INTEREST_OPTIONS.find((option) => option.value === feature);
}

export function getFeatureInterestLabel(
  feature: FeatureInterestOption,
  otherText?: string
): string {
  if (feature === 'other') {
    const safeText = otherText?.trim();
    return safeText ? `Other (${safeText})` : 'Other';
  }

  return getFeatureInterestOption(feature)?.label ?? 'Unknown';
}
