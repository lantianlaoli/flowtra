import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSocialCoverFileBaseName,
  buildSocialCoverFileNameMap,
  buildSocialCoverPrompt,
  buildSocialCoverSlots,
  buildSocialCoverTitleSet,
  DEFAULT_SOCIAL_COVER_STYLE_PRESETS,
  normalizeSocialCoverOptions,
  readStoredSocialCoverStylePresets,
  SOCIAL_COVER_LANGUAGE_OPTIONS,
  SOCIAL_COVER_STYLE_PRESETS_STORAGE_KEY,
  writeStoredSocialCoverStylePresets,
  type SocialCoverMetadata,
  type SocialCoverTitleSet,
  type SocialCoverSlot,
} from '../../lib/tools/social-cover-generator';
import {
  buildSocialCoverFailureUpdate,
  buildWebhookJobUpdate,
} from '../../lib/tools/kie-webhook-state';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function sampleSlots(): SocialCoverSlot[] {
  return [
    {
      id: 'cover-zh-4:3-1',
      language: 'zh',
      aspectRatio: '4:3',
      variantIndex: 1,
      title: '发布日',
      taskId: 'task-zh',
      status: 'processing',
      prompt: 'Chinese prompt',
    },
    {
      id: 'cover-en-3:4-1',
      language: 'en',
      aspectRatio: '3:4',
      variantIndex: 1,
      title: 'Launch Day',
      taskId: 'task-en',
      status: 'processing',
      prompt: 'English prompt',
    },
  ];
}

function titleSet(overrides: Partial<SocialCoverTitleSet> = {}): SocialCoverTitleSet {
  return Object.fromEntries(
    SOCIAL_COVER_LANGUAGE_OPTIONS.map((option) => [option.value, overrides[option.value] ?? 'Launch Day'])
  ) as SocialCoverTitleSet;
}

function sampleMetadata(): SocialCoverMetadata {
  return {
    source_title: 'Launch Day',
    titles: titleSet({ zh: '发布日', en: 'Launch Day' }),
    title_fallback: false,
    style_guide: 'Bold clean style',
    options: normalizeSocialCoverOptions({}),
    person_image_url: 'https://cdn.example.com/person.png',
    product_or_logo_image_url: 'https://cdn.example.com/logo.png',
    slots: sampleSlots(),
    completed_outputs: 0,
    total_outputs: 2,
    resolution: '1K',
  };
}

test('social cover options default to bilingual 4:3 and 3:4 with one variant', () => {
  const options = normalizeSocialCoverOptions({});
  assert.deepEqual(options.languages, ['zh', 'en']);
  assert.deepEqual(options.aspectRatiosByLanguage.zh, ['4:3', '3:4']);
  assert.deepEqual(options.aspectRatiosByLanguage.en, ['4:3', '3:4']);
  assert.deepEqual(options.aspectRatiosByLanguage.es, ['4:3', '3:4']);
  assert.deepEqual(options.aspectRatios, ['4:3', '3:4']);
  assert.equal(options.variantsPerGroup, 1);
  assert.equal(options.resolution, '1K');
});

test('social cover style presets persist in browser localStorage shape', () => {
  const storage = new MemoryStorage();
  const customPresets = [
    { id: 'custom-launch', name: 'Custom Launch', prompt: 'Bold founder cover with clean product logo.' },
  ];

  writeStoredSocialCoverStylePresets(storage, customPresets);

  assert.equal(storage.getItem(SOCIAL_COVER_STYLE_PRESETS_STORAGE_KEY), JSON.stringify(customPresets));
  assert.deepEqual(readStoredSocialCoverStylePresets(storage), customPresets);

  storage.setItem(SOCIAL_COVER_STYLE_PRESETS_STORAGE_KEY, 'not-json');
  assert.deepEqual(readStoredSocialCoverStylePresets(storage), DEFAULT_SOCIAL_COVER_STYLE_PRESETS);
});

test('social cover options allow each selected language to use different supported ratios', () => {
  const options = normalizeSocialCoverOptions({
    languages: ['es', 'ja', 'ar', 'nope'],
    aspectRatiosByLanguage: {
      es: ['1:1', '16:9', 'nope'],
      ja: ['auto', '9:16'],
      ar: ['3:4'],
    },
    variantsPerGroup: 4,
    resolution: '2K',
  });

  assert.deepEqual(options.languages, ['es', 'ja', 'ar']);
  assert.deepEqual(options.aspectRatiosByLanguage.es, ['1:1', '16:9']);
  assert.deepEqual(options.aspectRatiosByLanguage.ja, ['auto', '9:16']);
  assert.deepEqual(options.aspectRatiosByLanguage.ar, ['3:4']);
  assert.deepEqual(options.aspectRatiosByLanguage.zh, ['4:3', '3:4']);
  assert.equal(options.variantsPerGroup, 1);
  assert.equal(options.resolution, '1K');
});

test('social cover file names use title ratio language and created date', () => {
  const createdAt = new Date('2026-06-19T08:00:00+08:00').getTime();
  assert.equal(
    buildSocialCoverFileBaseName({ sourceTitle: 'Cat', createdAt }, { aspectRatio: '3:4', language: 'zh' }),
    'cat-34-cn-619'
  );
  assert.equal(
    buildSocialCoverFileBaseName({ sourceTitle: 'Cat', createdAt }, { aspectRatio: '16:9', language: 'en' }),
    'cat-169-en-619'
  );
  assert.equal(
    buildSocialCoverFileBaseName({ sourceTitle: 'Cat', createdAt }, { aspectRatio: '9:16', language: 'ja' }),
    'cat-916-ja-619'
  );
  assert.equal(
    buildSocialCoverFileBaseName({ sourceTitle: 'Cat', createdAt }, { aspectRatio: '1:1', language: 'ar' }),
    'cat-11-ar-619'
  );
  assert.equal(
    buildSocialCoverFileBaseName({ sourceTitle: '猫咪新品', createdAt }, { aspectRatio: '3:4', language: 'zh' }),
    'cover-34-cn-619'
  );
});

test('social cover ZIP filename map appends suffixes for duplicate names', () => {
  const createdAt = new Date('2026-06-19T08:00:00+08:00').getTime();
  const first = sampleSlots()[0];
  const slots = [
    { ...first, id: 'first', language: 'zh' as const, aspectRatio: '3:4' as const },
    { ...first, id: 'second', language: 'zh' as const, aspectRatio: '3:4' as const },
  ];

  assert.deepEqual(buildSocialCoverFileNameMap({ sourceTitle: 'Cat', createdAt, slots }), {
    first: 'cat-34-cn-619',
    second: 'cat-34-cn-619-2',
  });
});

test('social cover prompts enforce visible text language', () => {
  const expectations = [
    ['en', 'English'],
    ['zh', 'Simplified Chinese'],
    ['es', 'Spanish'],
    ['ja', 'Japanese'],
    ['ar', 'Arabic'],
  ] as const;

  for (const [language, promptLanguage] of expectations) {
    const prompt = buildSocialCoverPrompt({
      language,
      aspectRatio: '4:3',
      variantIndex: 1,
      title: 'Launch Day',
      sourceTitle: '新品发布',
      styleGuide: 'Minimal premium',
    });

    assert.match(prompt, new RegExp(`All newly generated visible cover text MUST be ${promptLanguage}`));
    assert.match(prompt, /Canvas\/aspect ratio: 4:3/);
  }
});

test('social cover title fallback fills every supported language', async () => {
  const result = await buildSocialCoverTitleSet('');
  assert.equal(result.fallback, true);
  for (const option of SOCIAL_COVER_LANGUAGE_OPTIONS) {
    assert.equal(result.titles[option.value], '');
  }
});

test('social cover slot generation creates expanded language and size combinations', () => {
  const options = normalizeSocialCoverOptions({
    languages: ['es', 'ja'],
    aspectRatiosByLanguage: {
      es: ['1:1', '16:9'],
      ja: ['3:4'],
    },
  });
  const slots = buildSocialCoverSlots({
    options,
    titles: titleSet({ es: 'Día de lanzamiento', ja: 'ローンチの日' }),
    sourceTitle: 'Launch Day',
    styleGuide: 'Clean launch style',
    taskIds: ['task-es-1', 'task-es-2', 'task-ja-1'],
  });

  assert.deepEqual(slots.map((slot) => slot.id), [
    'cover-es-1:1-1',
    'cover-es-16:9-1',
    'cover-ja-3:4-1',
  ]);
  assert.equal(slots[0].title, 'Día de lanzamiento');
  assert.equal(slots[2].title, 'ローンチの日');
});

test('social cover webhook success updates matching slot and completes when all covers are ready', () => {
  const metadata = sampleMetadata();
  metadata.slots[1] = { ...metadata.slots[1], status: 'success', resultUrl: 'https://cdn.example.com/en.png' };

  const update = buildWebhookJobUpdate({
    job: { tool_key: 'social-cover-generator', metadata },
    task: { metadata: { stage: 'image', slot_id: 'cover-zh-4:3-1' } },
    resultUrl: 'https://cdn.example.com/zh.png',
    webhookReceivedAt: '2026-06-19T00:00:00.000Z',
    siblingTasks: [],
  });

  const nextMetadata = update.metadata as SocialCoverMetadata;
  assert.equal(update.status, 'completed');
  assert.equal(update.result_url, 'https://cdn.example.com/zh.png');
  assert.equal(nextMetadata.completed_outputs, 2);
  assert.equal(nextMetadata.slots[0].status, 'success');
  assert.equal(nextMetadata.slots[0].resultUrl, 'https://cdn.example.com/zh.png');
});

test('social cover webhook failure marks matching slot failed', () => {
  const metadata = sampleMetadata();

  const update = buildSocialCoverFailureUpdate({
    job: { tool_key: 'social-cover-generator', metadata },
    task: { metadata: { stage: 'image', slot_id: 'cover-en-3:4-1' } },
    errorMessage: 'provider failed',
    webhookReceivedAt: '2026-06-19T00:00:00.000Z',
  });

  assert.ok(update);
  const nextMetadata = update.metadata as SocialCoverMetadata;
  assert.equal(update.status, 'failed');
  assert.equal(nextMetadata.slots[1].status, 'fail');
  assert.equal(nextMetadata.slots[1].error, 'provider failed');
});
