export type FeatureInterestOption =
  | 'ai_agent'
  | 'avatar_ads'
  | 'competitor_ugc_replication'
  | 'motion_swap'
  | 'other';

export type FeatureInterestOptionConfig = {
  value: FeatureInterestOption;
  label: string;
  isNew?: boolean;
};

export const FEATURE_INTEREST_OPTIONS: FeatureInterestOptionConfig[] = [
  { value: 'ai_agent', label: 'AI Agent', isNew: true },
  { value: 'avatar_ads', label: 'Avatar Ads' },
  { value: 'competitor_ugc_replication', label: 'Competitor UGC Replication' },
  { value: 'motion_swap', label: 'Motion Swap' },
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
