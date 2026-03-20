import {
  KLING_MAX_TASK_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS,
  type LanguageCode
} from '@/lib/constants';
import { estimateDialogueDuration } from '@/lib/dialogue-duration-estimator';

type AvatarPromptScene = {
  sceneIndex: number;
  prompt: Record<string, unknown>;
};

type BuildAvatarGeneratedPromptsInput = {
  imagePrompt: string | null | undefined;
  scriptSource: string | null | undefined;
  existingScenes?: AvatarPromptScene[] | null | undefined;
  language?: string | null;
};

const DEFAULT_VISUAL_PROMPT = {
  subject: 'Confident spokesperson from the selected avatar',
  context_environment: 'Clean creator-style setup that feels native to short-form ads',
  action: 'Speak directly to camera with precise hand gestures and strong product conviction',
  style: 'Polished UGC ad with direct response energy',
  camera_motion_positioning: 'Stable medium shot with gentle handheld realism',
  composition: 'Avatar centered with strong face visibility and clear focal separation',
  ambiance_color_lighting: 'Bright commercial lighting with crisp contrast',
  audio: 'Natural room tone under clean spoken dialogue'
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const splitBySentence = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return [] as string[];

  const sentences = normalized
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  return sentences.length > 0 ? sentences : [normalized];
};

const splitLongSentence = (sentence: string, language: string) => {
  const normalized = normalizeWhitespace(sentence);
  if (!normalized) return [] as string[];

  const clauseParts = normalized
    .split(/(?<=[,;:，；：])\s+/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const sourceParts = clauseParts.length > 1 ? clauseParts : [normalized];
  const expanded: string[] = [];

  sourceParts.forEach((part) => {
    if (estimateDialogueDuration(part, language) <= KLING_MAX_TASK_DURATION_SECONDS) {
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
        estimateDialogueDuration(candidate, language) > KLING_MAX_TASK_DURATION_SECONDS
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

export const normalizeAvatarPromptDuration = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return KLING_MIN_TASK_DURATION_SECONDS;
  }

  return Math.max(
    KLING_MIN_TASK_DURATION_SECONDS,
    Math.min(KLING_MAX_TASK_DURATION_SECONDS, Math.round(numeric))
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
}): AvatarPromptScene[] => {
  const scriptSource = normalizeWhitespace(input.scriptSource || '');
  const language = ((input.language || 'en') as LanguageCode);

  if (!scriptSource) {
    return (input.existingScenes || []).map((scene, index) => ({
      sceneIndex: index + 1,
      prompt: {
        ...DEFAULT_VISUAL_PROMPT,
        ...(scene.prompt || {}),
        dialog: typeof scene.prompt?.dialog === 'string' ? normalizeWhitespace(scene.prompt.dialog) : '',
        duration_seconds: normalizeAvatarPromptDuration(scene.prompt?.duration_seconds)
      }
    }));
  }

  const sentenceParts = splitBySentence(scriptSource)
    .flatMap((sentence) => splitLongSentence(sentence, language))
    .filter(Boolean);

  const buckets: string[] = [];
  let currentBucket = '';

  sentenceParts.forEach((part) => {
    const candidate = currentBucket ? `${currentBucket} ${part}` : part;
    if (
      currentBucket &&
      estimateDialogueDuration(candidate, language) > KLING_MAX_TASK_DURATION_SECONDS
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
      estimateDialogueDuration(lastBucket, language) < KLING_MIN_TASK_DURATION_SECONDS &&
      estimateDialogueDuration(`${previousBucket} ${lastBucket}`, language) <= KLING_MAX_TASK_DURATION_SECONDS
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
        duration_seconds: normalizeAvatarPromptDuration(estimateDialogueDuration(dialog, language))
      }
    };
  });
};

export const buildAvatarGeneratedPrompts = (input: BuildAvatarGeneratedPromptsInput) => {
  const scenes = buildAvatarScenesFromScript({
    scriptSource: input.scriptSource,
    existingScenes: input.existingScenes,
    language: input.language
  });

  const imagePrompt = normalizeWhitespace(input.imagePrompt || '');
  const totalDurationSeconds = scenes.reduce(
    (sum, scene) => sum + normalizeAvatarPromptDuration(scene.prompt.duration_seconds),
    0
  );

  return {
    generatedPrompts: {
      image_prompt: imagePrompt,
      scenes: scenes.map((scene) => ({
        prompt: scene.prompt
      }))
    },
    scenes,
    totalDurationSeconds: Math.max(totalDurationSeconds, KLING_MIN_TASK_DURATION_SECONDS)
  };
};
