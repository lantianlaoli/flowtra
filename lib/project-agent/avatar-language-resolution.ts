import { SUPPORTED_LANGUAGE_CODES, type LanguageCode } from '@/lib/constants';
import { recommendAvatarAdsSpokenLanguage } from '@/lib/avatar-ads-language-recommendation';
import { resolveAvatarSpokenLanguage } from '@/lib/avatar-spoken-language';
import type { ProjectAgentFeatureNodeConfig } from '@/lib/project-agent/canvas-state';

type LanguageRecommendation = {
  language: LanguageCode;
  reason?: string;
};

type RecommendLanguage = (input: {
  script: string;
  supportedLanguages: LanguageCode[];
}) => Promise<LanguageRecommendation>;

const getAvatarConfigLanguageOverride = (config?: ProjectAgentFeatureNodeConfig | null) => (
  config?.language && config.language !== 'en' ? config.language : null
);

export const resolveAgentAvatarSpokenLanguage = async (
  scriptSource: string,
  config?: ProjectAgentFeatureNodeConfig | null,
  options?: {
    recommendLanguage?: RecommendLanguage;
  },
): Promise<LanguageCode> => {
  const configuredLanguage = getAvatarConfigLanguageOverride(config);
  if (!scriptSource.trim()) {
    return resolveAvatarSpokenLanguage({
      scriptSource,
      configuredLanguage: configuredLanguage || config?.language || 'en',
    });
  }

  try {
    const recommendation = await (options?.recommendLanguage || recommendAvatarAdsSpokenLanguage)({
      script: scriptSource,
      supportedLanguages: SUPPORTED_LANGUAGE_CODES,
    });
    return recommendation.language;
  } catch (error) {
    console.warn('[project-agent/canvas-run] Avatar Ads language recommendation failed, using fallback detection:', error);
    return resolveAvatarSpokenLanguage({
      scriptSource,
      configuredLanguage,
    });
  }
};
