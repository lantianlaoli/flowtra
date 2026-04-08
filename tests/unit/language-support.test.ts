import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_LANGUAGE_CODES,
  getLanguagePromptName,
  getLanguageVoiceStyle,
} from '@/lib/constants';
import { formatLanguage, isValidLanguageCode } from '@/lib/language-utils';
import { normalizeSegmentPrompts } from '@/lib/video-clone-workflow';

test('shared language constants include Arabic metadata', () => {
  assert.equal(SUPPORTED_LANGUAGE_CODES.includes('ar'), true);
  assert.equal(getLanguagePromptName('ar'), 'Arabic (العربية)');
  assert.equal(getLanguageVoiceStyle('ar'), 'Arabic accent');
  assert.equal(isValidLanguageCode('ar'), true);
  assert.equal(formatLanguage('ar'), '🇸🇦 Arabic');
});

test('clone segment prompt normalization preserves Arabic language', () => {
  const normalized = normalizeSegmentPrompts(
    {
      segments: [
        {
          language: 'ar',
          first_frame_description: 'منتج على طاولة نظيفة',
          shots: [
            {
              id: 1,
              time_range: '0-8s',
              subject: 'المتحدث',
              action: 'يشير إلى المنتج',
              dialogue: 'هذا المنتج رائع',
              language: 'ar',
            },
          ],
        },
      ],
    },
    1,
  );

  assert.equal(normalized[0]?.language, 'ar');
  assert.equal(normalized[0]?.shots?.[0]?.language, 'ar');
});
