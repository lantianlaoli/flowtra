import {
  KLING_MAX_TASK_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS,
  SEEDANCE_MAX_TASK_DURATION_SECONDS,
  SEEDANCE_MIN_TASK_DURATION_SECONDS,
  getLanguagePromptName,
  type LanguageCode
} from '@/lib/constants';
import { estimateDialogueDuration } from '@/lib/dialogue-duration-estimator';
import {
  buildTypedMentionToken,
  MENTION_TOKEN_REGEX,
  parseMentionToken
} from '@/lib/prompt-mention-tokens';
import {
  buildAvatarVoiceType,
  inferAvatarVoiceGender,
  resolveAvatarSpokenLanguage,
} from '@/lib/avatar-spoken-language';

type AvatarPromptScene = {
  sceneIndex: number;
  prompt: Record<string, unknown>;
};

type BuildAvatarGeneratedPromptsInput = {
  imagePrompt: string | null | undefined;
  scriptSource: string | null | undefined;
  existingScenes?: AvatarPromptScene[] | null | undefined;
  language?: string | null;
  model?: AvatarDurationModel;
  avatarName?: string | null;
  productName?: string | null;
};

export type AvatarDurationModel = 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27';

const DEFAULT_VISUAL_PROMPT = {
  subject: 'Confident spokesperson from the selected avatar',
  context_environment: 'Clean creator-style setup that feels native to short-form ads',
  action: 'Speak directly to camera with precise hand gestures and strong product conviction',
  style: 'Polished UGC ad with direct response energy',
  camera_motion_positioning: 'Stable medium shot with gentle handheld realism',
  composition: 'Avatar centered with strong face visibility and clear focal separation',
  ambiance_color_lighting: 'Bright commercial lighting with crisp contrast',
  audio: 'Natural room tone under clean spoken dialogue',
  voice_type: 'Warm natural voice speaking natural English.',
};

const KLING_SAFE_DURATION_BUFFER_SECONDS = 1;
const KLING_RISKY_COPY_BUFFER_SECONDS = 1.5;
const RISKY_DIALOGUE_PATTERN = /(?:[$€£¥]\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?-inch|—|–|,|;|:|\b(?:honestly|literally|seriously|definitely|worth it|perfect for|such a steal|starting out)\b)/i;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripAvatarImagePromptBoilerplate = (value: string) => (
  normalizeWhitespace(
    value
      .replace(/\b(?:9\s*:\s*16|16\s*:\s*9)\b/gi, '')
      .replace(/\bportrait\s+(?:ratio|format)\b/gi, 'portrait')
      .replace(/\bhigh[-\s]?quality\b/gi, '')
      .replace(/\s+([,.;:])/g, '$1')
      .replace(/([,.;:]){2,}/g, '$1')
  )
);

const getMentionKeys = (value: string) => {
  const keys = new Set<string>();
  if (!value) return keys;

  for (const match of value.matchAll(MENTION_TOKEN_REGEX)) {
    const parsed = parseMentionToken(match[0]);
    if (!parsed?.key) continue;
    keys.add(parsed.key);
  }

  return keys;
};

export const ensureAvatarImagePromptMentions = (input: {
  imagePrompt: string | null | undefined;
  avatarName?: string | null;
  productName?: string | null;
}) => {
  const avatarToken = input.avatarName
    ? buildTypedMentionToken({ type: 'character', label: input.avatarName })
    : '';
  const productToken = input.productName
    ? buildTypedMentionToken({ type: 'product', label: input.productName })
    : '';
  const avatarKey = avatarToken ? parseMentionToken(avatarToken)?.key : '';
  const productKey = productToken ? parseMentionToken(productToken)?.key : '';
  const normalized = stripAvatarImagePromptBoilerplate(input.imagePrompt || '');
  const existingKeys = getMentionKeys(normalized);
  let nextPrompt = normalized;

  if (!nextPrompt) {
    if (avatarToken && productToken) {
      return `${avatarToken} speaking directly to camera in a creator-style talking-head setup, naturally holding ${productToken}, clean lifestyle background, natural light.`;
    }
    if (avatarToken) {
      return `${avatarToken} speaking directly to camera in a creator-style talking-head setup, clean background, natural light.`;
    }
    return '';
  }

  if (input.avatarName && avatarToken) {
    const avatarLabelPattern = new RegExp(escapeRegExp(input.avatarName), 'gi');
    nextPrompt = nextPrompt.replace(avatarLabelPattern, avatarToken);
  }

  if (input.productName && productToken) {
    const productLabelPattern = new RegExp(escapeRegExp(input.productName), 'gi');
    nextPrompt = nextPrompt.replace(productLabelPattern, productToken);
  }

  if (avatarToken && avatarKey && !existingKeys.has(avatarKey) && !nextPrompt.includes(avatarToken)) {
    nextPrompt = `${avatarToken} speaking directly to camera, ${nextPrompt.charAt(0).toLowerCase()}${nextPrompt.slice(1)}`;
  }

  if (productToken && productKey && !existingKeys.has(productKey) && !nextPrompt.includes(productToken)) {
    nextPrompt = `${nextPrompt.replace(/[.,\s]+$/, '')}, naturally featuring ${productToken}.`;
  }

  return normalizeWhitespace(nextPrompt);
};

const splitBySentence = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return [] as string[];

  const sentences = normalized
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  return sentences.length > 0 ? sentences : [normalized];
};

const splitLongSentence = (sentence: string, language: string, model: AvatarDurationModel) => {
  const normalized = normalizeWhitespace(sentence);
  if (!normalized) return [] as string[];

  if (estimateDialogueDuration(normalized, language) <= getScenePlanningLimitSeconds(normalized, language, model)) {
    return [normalized];
  }

  const clauseParts = normalized
    .split(/(?<=[,;:，；：]|—|–)\s*/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const sourceParts = clauseParts.length > 1 ? clauseParts : [normalized];
  const expanded: string[] = [];
  const bounds = getDurationBoundsByModel(model);

  sourceParts.forEach((part) => {
    if (estimateDialogueDuration(part, language) <= bounds.maxDurationSeconds) {
      expanded.push(part);
      return;
    }

    const words = part.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      expanded.push(part);
      return;
    }

    let current = '';
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (
        current &&
        estimateDialogueDuration(candidate, language) > getScenePlanningLimitSeconds(candidate, language, model)
      ) {
        expanded.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) {
      expanded.push(current);
    }
  });

  return expanded;
};

const getDurationBoundsByModel = (model: AvatarDurationModel) => {
  if (model === 'kling_3') {
    return {
      minDurationSeconds: KLING_MIN_TASK_DURATION_SECONDS,
      maxDurationSeconds: KLING_MAX_TASK_DURATION_SECONDS,
      planningLimitSeconds: KLING_MAX_TASK_DURATION_SECONDS - KLING_SAFE_DURATION_BUFFER_SECONDS
    };
  }

  if (model === 'wan_27') {
    return {
      minDurationSeconds: 2,
      maxDurationSeconds: 15,
      planningLimitSeconds: 15
    };
  }

  return {
    minDurationSeconds: SEEDANCE_MIN_TASK_DURATION_SECONDS,
    maxDurationSeconds: SEEDANCE_MAX_TASK_DURATION_SECONDS,
    planningLimitSeconds: SEEDANCE_MAX_TASK_DURATION_SECONDS
  };
};

export const normalizeAvatarPromptDuration = (
  value: unknown,
  model: AvatarDurationModel = 'kling_3'
) => {
  const bounds = getDurationBoundsByModel(model);
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return bounds.minDurationSeconds;
  }

  return Math.max(
    bounds.minDurationSeconds,
    Math.min(bounds.maxDurationSeconds, Math.round(numeric))
  );
};

const getScenePlanningLimitSeconds = (
  dialogue: string,
  language: string,
  model: AvatarDurationModel
) => {
  const bounds = getDurationBoundsByModel(model);
  if (model !== 'kling_3') {
    return bounds.planningLimitSeconds;
  }

  const baseLimit = language === 'en'
    ? bounds.planningLimitSeconds
    : KLING_MAX_TASK_DURATION_SECONDS - 0.5;

  if (language === 'en' && RISKY_DIALOGUE_PATTERN.test(dialogue)) {
    return Math.max(KLING_MIN_TASK_DURATION_SECONDS, KLING_MAX_TASK_DURATION_SECONDS - KLING_RISKY_COPY_BUFFER_SECONDS);
  }

  return Math.max(KLING_MIN_TASK_DURATION_SECONDS, baseLimit);
};

const getTargetDurationSeconds = (
  dialogue: string,
  language: string,
  model: AvatarDurationModel
) => {
  const bounds = getDurationBoundsByModel(model);
  const estimated = estimateDialogueDuration(dialogue, language);
  const bufferedEstimate = estimated + (language === 'en' ? 0.6 : 0.3);
  const planningLimit = getScenePlanningLimitSeconds(dialogue, language, model);

  return Math.max(
    bounds.minDurationSeconds,
    Math.min(Math.ceil(bufferedEstimate), Math.floor(planningLimit))
  );
};

const resolvePromptTemplate = (
  existingScenes: AvatarPromptScene[] | null | undefined,
  index: number
) => {
  const prompt = existingScenes?.[index]?.prompt ?? existingScenes?.[0]?.prompt;
  if (!prompt || typeof prompt !== 'object') {
    return DEFAULT_VISUAL_PROMPT;
  }

  return {
    ...DEFAULT_VISUAL_PROMPT,
    ...prompt
  };
};

export const buildAvatarScenesFromScript = (input: {
  scriptSource: string | null | undefined;
  existingScenes?: AvatarPromptScene[] | null | undefined;
  language?: string | null;
  model?: AvatarDurationModel;
}): AvatarPromptScene[] => {
  const scriptSource = normalizeWhitespace(input.scriptSource || '');
  const model: AvatarDurationModel = input.model || 'seedance_2_fast';
  const language = resolveAvatarSpokenLanguage({
    scriptSource,
    configuredLanguage: input.language || 'en',
  });

  if (!scriptSource) {
    return (input.existingScenes || []).map((scene, index) => ({
      sceneIndex: index + 1,
      prompt: {
        ...DEFAULT_VISUAL_PROMPT,
        ...(scene.prompt || {}),
        dialog: typeof scene.prompt?.dialog === 'string' ? normalizeWhitespace(scene.prompt.dialog) : '',
        duration_seconds: normalizeAvatarPromptDuration(scene.prompt?.duration_seconds, model),
        resolved_spoken_language: language,
        voice_type: buildAvatarVoiceType(
          language,
          inferAvatarVoiceGender(scene.prompt?.voice_type, scene.prompt?.subject)
        ),
      }
    }));
  }

  const sentenceParts = splitBySentence(scriptSource)
    .flatMap((sentence) => splitLongSentence(sentence, language, model))
    .filter(Boolean);

  const buckets: string[] = [];
  let currentBucket = '';

  sentenceParts.forEach((part) => {
    const candidate = currentBucket ? `${currentBucket} ${part}` : part;
    if (
      currentBucket &&
      estimateDialogueDuration(candidate, language) > getScenePlanningLimitSeconds(candidate, language, model)
    ) {
      buckets.push(currentBucket);
      currentBucket = part;
      return;
    }

    currentBucket = candidate;
  });

  if (currentBucket) {
    buckets.push(currentBucket);
  }

  if (buckets.length > 1) {
    const lastBucket = buckets[buckets.length - 1];
    const previousBucket = buckets[buckets.length - 2];
    if (
      estimateDialogueDuration(lastBucket, language) < getDurationBoundsByModel(model).minDurationSeconds &&
      estimateDialogueDuration(`${previousBucket} ${lastBucket}`, language) <= getScenePlanningLimitSeconds(`${previousBucket} ${lastBucket}`, language, model)
    ) {
      buckets.splice(buckets.length - 2, 2, `${previousBucket} ${lastBucket}`);
    }
  }

  return buckets.map((dialog, index) => {
    const template = resolvePromptTemplate(input.existingScenes, index);
    return {
      sceneIndex: index + 1,
      prompt: {
        ...template,
        dialog,
        duration_seconds: getTargetDurationSeconds(dialog, language, model),
        resolved_spoken_language: language,
        voice_type: buildAvatarVoiceType(
          language,
          inferAvatarVoiceGender(template.voice_type, template.subject)
        ),
      }
    };
  });
};

export const buildAvatarGeneratedPrompts = (input: BuildAvatarGeneratedPromptsInput) => {
  const model: AvatarDurationModel = input.model || 'seedance_2_fast';
  const scenes = buildAvatarScenesFromScript({
    scriptSource: input.scriptSource,
    existingScenes: input.existingScenes,
    language: input.language,
    model
  });

  const imagePrompt = ensureAvatarImagePromptMentions({
    imagePrompt: input.imagePrompt,
    avatarName: input.avatarName,
    productName: input.productName
  });
  const totalDurationSeconds = scenes.reduce(
    (sum, scene) => sum + normalizeAvatarPromptDuration(scene.prompt.duration_seconds, model),
    0
  );
  const minDurationSeconds = getDurationBoundsByModel(model).minDurationSeconds;

  return {
    generatedPrompts: {
      image_prompt: imagePrompt,
      language: getLanguagePromptName(resolveAvatarSpokenLanguage({
        scriptSource: input.scriptSource,
        configuredLanguage: input.language || 'en',
      })),
      resolved_spoken_language: resolveAvatarSpokenLanguage({
        scriptSource: input.scriptSource,
        configuredLanguage: input.language || 'en',
      }),
      planned_total_duration_seconds: Math.max(totalDurationSeconds, minDurationSeconds),
      planned_scene_duration_seconds: scenes.map((scene) => normalizeAvatarPromptDuration(scene.prompt.duration_seconds, model)),
      scenes: scenes.map((scene) => ({
        prompt: scene.prompt
      }))
    },
    scenes,
    totalDurationSeconds: Math.max(totalDurationSeconds, minDurationSeconds)
  };
};
