import { NextRequest, NextResponse } from 'next/server';
import type { LanguageCode } from '@/lib/constants';
import {
  AvatarAdsLanguageRecommendationError,
  recommendAvatarAdsSpokenLanguage,
} from '@/lib/avatar-ads-language-recommendation';

type LanguageRecommendRequest = {
  script?: string;
  supportedLanguages?: LanguageCode[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LanguageRecommendRequest;
    const recommendation = await recommendAvatarAdsSpokenLanguage({
      script: body.script,
      supportedLanguages: Array.isArray(body.supportedLanguages) ? body.supportedLanguages : [],
    });

    return NextResponse.json({
      success: true,
      language: recommendation.language,
      reason: recommendation.reason,
    });
  } catch (error) {
    if (error instanceof AvatarAdsLanguageRecommendationError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to recommend language.' },
      { status: 500 }
    );
  }
}
