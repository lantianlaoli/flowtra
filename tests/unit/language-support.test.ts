import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_LANGUAGE_CODES,
  getLanguagePromptName,
  getLanguageVoiceStyle,
} from '@/lib/constants';
import { formatLanguage, isValidLanguageCode } from '@/lib/language-utils';
import { normalizeSegmentPrompts } from '@/lib/video-clone-workflow';

test('shared language constants include Mandarin Chinese metadata', () => {
  assert.equal(SUPPORTED_LANGUAGE_CODES.includes('zh'), true);
  assert.equal(getLanguagePromptName('zh'), 'Chinese (Mandarin)');
  assert.equal(getLanguageVoiceStyle('zh'), 'Mandarin Chinese accent');
  assert.equal(isValidLanguageCode('zh'), true);
  assert.equal(formatLanguage('zh'), '🇨🇳 Chinese (Mandarin)');
});

test('clone segment prompt normalization preserves Mandarin language', () => {
  const normalized = normalizeSegmentPrompts(
    {
      segments: [
        {
          language: 'zh',
          first_frame_description: '产品放在干净的桌面上',
          shots: [
            {
              id: 1,
              time_range: '0-8s',
              subject: '讲述者',
              action: '指向产品',
              dialogue: '这个产品很棒',
              language: 'zh',
            },
          ],
        },
      ],
    },
    1,
  );

  assert.equal(normalized[0]?.language, 'zh');
  assert.equal(normalized[0]?.shots?.[0]?.language, 'zh');
});
