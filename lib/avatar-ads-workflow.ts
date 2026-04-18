import { getSupabaseAdmin } from '@/lib/supabase';
import {
  GENERATION_COSTS,
  KLING_MAX_TASK_DURATION_SECONDS,
  NON_AGENT_IMAGE_MODEL,
  NON_AGENT_IMAGE_OUTPUT_FORMAT,
  NON_AGENT_IMAGE_RESOLUTION,
  SEEDANCE_MAX_TASK_DURATION_SECONDS,
  SEEDANCE_MIN_TASK_DURATION_SECONDS,
  getGenerationCost,
  getLanguagePromptName,
  getSegmentVideoGenerationCost,
  type LanguageCode
} from '@/lib/constants';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import { mergeVideosWithFal, checkFalTaskStatus } from '@/lib/video-merge';
import { checkCredits, deductCredits, recordCreditTransaction } from '@/lib/credits';
import { generateDialogueLengthGuidance } from '@/lib/dialogue-duration-estimator';
import { extractOpenRouterJsonContent, extractOpenRouterTextContent, sendOpenRouterChat } from '@/lib/openrouter';
import { MENTION_TOKEN_REGEX, parseMentionToken } from '@/lib/prompt-mention-tokens';
import {
  buildAvatarGeneratedPrompts,
  ensureAvatarImagePromptMentions,
  normalizeAvatarPromptDuration
} from '@/lib/project-agent/avatar-script-planning';
import {
  buildAvatarVoiceType,
  inferAvatarVoiceGender,
  resolveAvatarSpokenLanguage,
} from '@/lib/avatar-spoken-language';
import {
  estimateAvatarAdsDialogueSeconds,
  estimateAvatarAdsSingleSceneDurationSeconds,
} from '@/lib/avatar-ads-duration-estimate';
// Events table removed: no tracking imports

const DEFAULT_VIDEO_MODEL = 'seedance_2_fast' as const;

type AvatarPromptActionBeat = {
  time: string;
  description: string;
};

type AvatarPromptDialogMap = Record<string, string>;

type AvatarScenePromptShape = {
  subject?: string;
  context_environment?: string;
  action?: string | AvatarPromptActionBeat[];
  style?: string;
  camera_motion_positioning?: string;
  composition?: string;
  ambiance_color_lighting?: string;
  audio?: string;
  dialog?: string | AvatarPromptDialogMap;
  voice_type?: string;
  duration_seconds?: number;
  resolved_spoken_language?: string;
  [key: string]: unknown;
};

type AvatarPromptResponseShape = {
  image_prompt?: string;
  language?: string;
  resolved_spoken_language?: string;
  scenes?: Array<{
    scene?: number | string;
    prompt?: AvatarScenePromptShape;
  }>;
  planned_total_duration_seconds?: number;
  planned_scene_duration_seconds?: number[];
};

interface AvatarAdsProject {
  id: string;
  user_id: string;
  person_image_urls: string[];
  product_image_urls: string[];
  video_duration_seconds: number;
  image_model: string;
  image_size?: string;
  image_prompt?: string; // Prompt used for cover image generation
  video_model: string;
  video_aspect_ratio?: string;
  custom_dialogue?: string;
  language?: string;
  status: string;
  current_step: string;
  progress_percentage: number;
  image_analysis_result?: Record<string, unknown>;
  generated_prompts?: Record<string, unknown>;
  generated_image_url?: string;
  generated_video_urls?: string[];
  merged_video_url?: string;
  kie_image_task_id?: string;
  kie_video_task_ids?: string[];
  fal_merge_task_id?: string;
  error_message?: string;
  last_processed_at?: string;
  webhook_received_at?: string; // NEW: Timestamp when webhook was received from KIE API
  last_webhook_check?: string; // NEW: Timestamp of last fallback polling check
  product_context?: {
    product_name?: string;
    talking_head_script?: string;
  } | null;
  avatar_name?: string;
  avatar_gender?: 'male' | 'female' | null;
}

interface ProcessResult {
  project: AvatarAdsProject;
  message: string;
  nextStep?: string;
}

const AVATAR_PROMPT_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: {
    name: 'avatar_ads_prompt_payload',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['image_prompt', 'language', 'resolved_spoken_language', 'scenes'],
      properties: {
        image_prompt: {
          type: 'string',
          description: 'Concrete image prompt for the avatar ads cover frame.'
        },
        language: {
          type: 'string',
          description: 'Human-readable spoken language label that matches the selected config language exactly.'
        },
        resolved_spoken_language: {
          type: 'string',
          description: 'Canonical language code used for spoken delivery, such as en, zh, zh_yue, ja, ko, es, fr, de, pt.'
        },
        scenes: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['scene', 'prompt'],
            properties: {
              scene: {
                type: 'number'
              },
              prompt: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'subject',
                  'context_environment',
                  'action',
                  'style',
                  'camera_motion_positioning',
                  'composition',
                  'ambiance_color_lighting',
                  'audio',
                  'dialog',
                  'voice_type'
                ],
                properties: {
                  subject: { type: 'string' },
                  context_environment: { type: 'string' },
                  action: {
                    type: 'array',
                    minItems: 1,
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['time', 'description'],
                      properties: {
                        time: { type: 'string' },
                        description: { type: 'string' }
                      }
                    }
                  },
                  style: { type: 'string' },
                  camera_motion_positioning: { type: 'string' },
                  composition: { type: 'string' },
                  ambiance_color_lighting: { type: 'string' },
                  audio: { type: 'string' },
                  dialog: {
                    type: 'object',
                    minProperties: 1,
                    additionalProperties: {
                      type: 'string'
                    }
                  },
                  voice_type: { type: 'string' },
                  duration_seconds: { type: 'number' },
                  resolved_spoken_language: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }
} as const;

export const resolveAvatarAdsVideoModel = (project: Pick<AvatarAdsProject, 'video_model'>) => {
  if (project.video_model === 'wan_27') return 'wan_27';
  if (project.video_model === 'kling_3') return 'kling_3';
  if (project.video_model === 'seedance_2') return 'seedance_2';
  return DEFAULT_VIDEO_MODEL;
};

const isAvatarAdsKlingProject = (project: Pick<AvatarAdsProject, 'video_model'>) => (
  resolveAvatarAdsVideoModel(project) === 'kling_3'
);

export const compileAvatarAdsMentionText = (value: string) => {
  if (!value) return value;
  return value.replace(MENTION_TOKEN_REGEX, (match) => {
    const parsed = parseMentionToken(match);
    if (!parsed) return match;
    return (parsed.label || parsed.key || match).replace(/[_-]+/g, ' ').trim();
  });
};

const getAvatarAdsModelSceneDurationRule = (
  model: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27'
) => {
  if (model === 'kling_3') return 'between 3 and 15 seconds';
  if (model === 'wan_27') return 'between 2 and 15 seconds';
  return 'between 4 and 15 seconds';
};

const getAvatarAdsTargetSceneDuration = (
  model: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27'
) => {
  if (model === 'wan_27') return 15;
  if (model === 'kling_3') return KLING_MAX_TASK_DURATION_SECONDS;
  return SEEDANCE_MAX_TASK_DURATION_SECONDS;
};

export const getAvatarPromptScenes = (generatedPrompts: Record<string, unknown> | null | undefined) => (
  Array.isArray(generatedPrompts?.scenes)
    ? generatedPrompts.scenes as Array<{ prompt?: Record<string, unknown> | null }>
    : []
);

export const getAvatarPlannedSceneDurations = (
  generatedPrompts: Record<string, unknown> | null | undefined
) => (
  Array.isArray(generatedPrompts?.planned_scene_duration_seconds)
    ? generatedPrompts.planned_scene_duration_seconds.map((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
    })
    : []
);

export const getAvatarSceneDurationSeconds = (
  prompt: Record<string, unknown> | null | undefined,
  model: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27',
  options?: {
    plannedDurationSeconds?: number | null;
    totalScenes?: number;
    language?: string | null;
  }
) => {
  if (model === 'kling_3') {
    return normalizeAvatarPromptDuration(prompt?.duration_seconds, 'kling_3');
  }

  if (model === 'wan_27') {
    const explicitDuration = Number(prompt?.duration_seconds);
    if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
      return Math.max(2, Math.min(15, Math.round(explicitDuration)));
    }
    const plannedDuration = Number(options?.plannedDurationSeconds);
    if (Number.isFinite(plannedDuration) && plannedDuration > 0) {
      return Math.max(2, Math.min(15, Math.round(plannedDuration)));
    }
    const dialog = typeof prompt?.dialog === 'string' ? prompt.dialog.trim() : '';
    if (dialog) {
      const estimated = estimateAvatarAdsDialogueSeconds(
        dialog,
        model,
        options?.language || 'en'
      );
      if (Number.isFinite(estimated) && estimated > 0) {
        if ((options?.totalScenes ?? 1) <= 1 && estimated <= 7.5) {
          return Math.max(2, Math.min(7, Math.ceil(estimated)));
        }
        return Math.max(2, Math.min(15, Math.ceil(estimated + 0.4)));
      }
    }
    return 5;
  }

  const explicitDuration = Number(prompt?.duration_seconds);
  if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
    return Math.max(SEEDANCE_MIN_TASK_DURATION_SECONDS, Math.min(SEEDANCE_MAX_TASK_DURATION_SECONDS, Math.round(explicitDuration)));
  }

  const plannedDuration = Number(options?.plannedDurationSeconds);
  if (Number.isFinite(plannedDuration) && plannedDuration > 0) {
    return Math.max(SEEDANCE_MIN_TASK_DURATION_SECONDS, Math.min(SEEDANCE_MAX_TASK_DURATION_SECONDS, Math.round(plannedDuration)));
  }

  const dialog = typeof prompt?.dialog === 'string' ? prompt.dialog.trim() : '';
  if (dialog) {
    if ((options?.totalScenes ?? 1) <= 1) {
      const estimatedSingleSceneDuration = estimateAvatarAdsSingleSceneDurationSeconds(
        dialog,
        model,
        options?.language || 'en'
      );
      if (estimatedSingleSceneDuration > 0) {
        return estimatedSingleSceneDuration;
      }
    }

    const languageCode = resolveAvatarSpokenLanguage({
      scriptSource: dialog,
      configuredLanguage: options?.language || 'en',
    });
    const estimated = estimateAvatarAdsDialogueSeconds(dialog, model, languageCode);
    if (Number.isFinite(estimated) && estimated > 0) {
      return Math.max(8, Math.min(SEEDANCE_MAX_TASK_DURATION_SECONDS, Math.ceil(estimated + 0.4)));
    }
  }

  return 12;
};

export const getAvatarPlannedTotalDurationSeconds = (
  generatedPrompts: Record<string, unknown> | null | undefined,
  model: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27',
  fallbackDurationSeconds: number,
  language?: string | null
) => {
  const promptScenes = getAvatarPromptScenes(generatedPrompts);
  if (promptScenes.length === 0) {
    return fallbackDurationSeconds;
  }

  const total = promptScenes.reduce((sum, scene) => (
    sum + getAvatarSceneDurationSeconds(
      (scene?.prompt as Record<string, unknown> | null | undefined) ?? null,
      model,
      { language }
    )
  ), 0);

  return total > 0 ? total : fallbackDurationSeconds;
};

export const buildAvatarAdsVideoExecutionPrompt = (
  prompt: Record<string, unknown>,
  options?: {
    hasProductContext?: boolean;
    language?: string | null;
    durationSeconds?: number;
    avatarGender?: 'male' | 'female' | null;
  }
) => {
  const promptObj = prompt as {
    voice_type?: string;
    subject?: string;
    context_environment?: string;
    action?: unknown;
    style?: string;
    camera_motion_positioning?: string;
    composition?: string;
    ambiance_color_lighting?: string;
    audio?: string;
    dialog?: unknown;
    resolved_spoken_language?: string;
    [key: string]: unknown;
  };

  const resolvedLanguageRaw = options?.language
    ? options.language
    : (typeof promptObj.resolved_spoken_language === 'string' && promptObj.resolved_spoken_language)
      ? promptObj.resolved_spoken_language
      : resolveAvatarSpokenLanguage({
        scriptSource: typeof promptObj.dialog === 'string' ? promptObj.dialog : '',
        configuredLanguage: options?.language || null,
      });
  // Ensure it's a valid LanguageCode
  const validLanguageCodes: LanguageCode[] = ['en', 'zh', 'zh_yue', 'ja', 'ko', 'es', 'fr', 'de', 'pt'];
  const resolvedLanguage = validLanguageCodes.includes(resolvedLanguageRaw as LanguageCode)
    ? resolvedLanguageRaw as LanguageCode
    : 'en';
  const durationSeconds = Math.max(2, Math.round(options?.durationSeconds || 8));
  const hasStructuredDialog = isAvatarStructuredDialog(promptObj.dialog);
  const hasStructuredAction = isAvatarStructuredAction(promptObj.action);
  const hasStructuredFields = Boolean(
    cleanAvatarExecutionField(promptObj.subject) &&
    cleanAvatarExecutionField(promptObj.context_environment) &&
    cleanAvatarExecutionField(promptObj.style) &&
    cleanAvatarExecutionField(promptObj.camera_motion_positioning) &&
    cleanAvatarExecutionField(promptObj.composition) &&
    cleanAvatarExecutionField(promptObj.ambiance_color_lighting) &&
    cleanAvatarExecutionField(promptObj.audio) &&
    hasStructuredDialog &&
    hasStructuredAction
  );

  const executionPayload = hasStructuredFields
    ? {
      language: getAvatarExecutionLanguageLabel(resolvedLanguage),
      subject: cleanAvatarExecutionField(promptObj.subject),
      context_environment: cleanAvatarExecutionField(promptObj.context_environment),
      action: sanitizeAvatarStructuredAction(promptObj.action),
      style: cleanAvatarExecutionField(promptObj.style),
      camera_motion_positioning: cleanAvatarExecutionField(promptObj.camera_motion_positioning),
      composition: cleanAvatarExecutionField(promptObj.composition),
      ambiance_colour_lighting: cleanAvatarExecutionField(promptObj.ambiance_color_lighting),
      audio: cleanAvatarExecutionField(promptObj.audio),
      dialog: sanitizeAvatarStructuredDialog(promptObj.dialog),
    }
    : {
      language: getAvatarExecutionLanguageLabel(resolvedLanguage),
      subject: cleanAvatarExecutionField(promptObj.subject),
      context_environment: cleanAvatarExecutionField(promptObj.context_environment),
      action: compileAvatarExecutionAction(
        promptObj.action,
        Object.keys(compileAvatarExecutionDialog(promptObj.dialog, durationSeconds)),
        durationSeconds,
        Boolean(options?.hasProductContext)
      ),
      style: cleanAvatarExecutionField(promptObj.style),
      camera_motion_positioning: cleanAvatarExecutionField(promptObj.camera_motion_positioning),
      composition: cleanAvatarExecutionField(promptObj.composition),
      ambiance_colour_lighting: cleanAvatarExecutionField(promptObj.ambiance_color_lighting),
      audio: cleanAvatarExecutionField(promptObj.audio),
      dialog: compileAvatarExecutionDialog(promptObj.dialog, durationSeconds),
    };

  return JSON.stringify(executionPayload, null, 2);
};

const cleanAvatarExecutionField = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const compiled = compileAvatarAdsMentionText(value).replace(/^"|"$/g, '').trim();
  return compiled.replace(/\s+/g, ' ').trim();
};

const getAvatarExecutionLanguageLabel = (language: LanguageCode) => {
  switch (language) {
    case 'zh_yue':
      return '粤语';
    case 'zh':
      return '普通话';
    case 'ja':
      return '日本語';
    case 'ko':
      return '한국어';
    case 'es':
      return 'Español';
    case 'fr':
      return 'Français';
    case 'de':
      return 'Deutsch';
    case 'pt':
      return 'Português';
    default:
      return 'English';
  }
};

const splitAvatarDialogClauses = (value: string) => {
  const normalized = compileAvatarAdsMentionText(value)
    .replace(/\s+/g, ' ')
    .replace(/([。！？!?；;，,])/g, '$1|')
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [value.trim()];
};

const buildAvatarExecutionTimeRanges = (count: number, durationSeconds: number) => {
  const safeCount = Math.max(1, Math.min(count, durationSeconds));
  const rawBoundaries = Array.from({ length: safeCount + 1 }, (_, index) => (
    Math.round((index * durationSeconds) / safeCount)
  ));

  const boundaries = rawBoundaries.map((value, index) => {
    if (index === 0) return 0;
    if (index === rawBoundaries.length - 1) return durationSeconds;
    const previous = rawBoundaries[index - 1];
    return Math.max(previous + 1, value);
  });

  const normalizedBoundaries = boundaries.map((value, index) => {
    if (index === 0) return 0;
    if (index === boundaries.length - 1) return durationSeconds;
    const remainingSlots = boundaries.length - 1 - index;
    return Math.min(value, durationSeconds - remainingSlots);
  });

  return Array.from({ length: safeCount }, (_, index) => {
    const start = normalizedBoundaries[index];
    const end = index === safeCount - 1
      ? durationSeconds
      : Math.max(start + 1, normalizedBoundaries[index + 1]);
    return `${start}-${end}s`;
  });
};

const normalizeAvatarTimeKey = (value: string, fallbackIndex: number, ranges: string[]) => {
  const trimmed = value.trim();
  const match = trimmed.match(/(\d+)\s*-\s*(\d+)\s*s?/i);
  if (match) {
    return `${match[1]}-${match[2]}s`;
  }
  return ranges[fallbackIndex] || trimmed;
};

const isAvatarStructuredDialog = (dialog: unknown): dialog is Record<string, unknown> => (
  dialog !== null &&
  typeof dialog === 'object' &&
  !Array.isArray(dialog) &&
  Object.keys(dialog).length > 0
);

const sanitizeAvatarStructuredDialog = (dialog: unknown) => {
  if (!isAvatarStructuredDialog(dialog)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(dialog)
      .map(([time, content]) => [normalizeAvatarTimeKey(time, 0, []), cleanAvatarExecutionField(content)] as const)
      .filter(([, content]) => content)
  );
};

const isAvatarStructuredAction = (action: unknown): action is Array<Record<string, unknown>> => (
  Array.isArray(action) && action.some((entry) => (
    Boolean(entry) &&
    typeof entry === 'object' &&
    typeof (entry as Record<string, unknown>).description === 'string'
  ))
);

const sanitizeAvatarStructuredAction = (action: unknown) => {
  if (!isAvatarStructuredAction(action)) {
    return [];
  }

  return action
    .map((entry, index) => {
      const record = entry as Record<string, unknown>;
      const description = cleanAvatarExecutionField(record.description);
      if (!description) return null;
      const timeValue = typeof record.time === 'string' ? record.time : '';
      return {
        time: timeValue ? normalizeAvatarTimeKey(timeValue, index, []) : '',
        description,
      };
    })
    .filter((entry): entry is { time: string; description: string } => Boolean(entry));
};

const compileAvatarExecutionDialog = (dialog: unknown, durationSeconds: number) => {
  if (dialog && typeof dialog === 'object' && !Array.isArray(dialog)) {
    const entries = Object.entries(dialog as Record<string, unknown>)
      .map(([time, content]) => [time, cleanAvatarExecutionField(content)] as const)
      .filter(([, content]) => content);
    if (entries.length > 0) {
      const fallbackRanges = buildAvatarExecutionTimeRanges(entries.length, durationSeconds);
      return Object.fromEntries(
        entries.map(([time, content], index) => [normalizeAvatarTimeKey(time, index, fallbackRanges), content])
      );
    }
  }

  const dialogText = cleanAvatarExecutionField(dialog);
  if (!dialogText) {
    return {};
  }

  const clauses = splitAvatarDialogClauses(dialogText);
  const ranges = buildAvatarExecutionTimeRanges(clauses.length, durationSeconds);
  return Object.fromEntries(
    clauses.map((clause, index) => [ranges[index], clause])
  );
};

const getAvatarExecutionActionBeats = (hasProductContext: boolean) => {
  if (hasProductContext) {
    return [
      'Lift the product toward the camera with a friendly attention hook.',
      'Turn the product forward and show the packaging clearly.',
      'Demonstrate the product naturally with a satisfied reaction.',
      'Bring the product slightly closer to camera and close with a confident recommendation.',
    ];
  }

  return [
    'Open facing the camera with a friendly attention hook and natural nod.',
    'Speak directly to camera with a clear expressive point and natural hand gesture.',
    'React warmly to the key benefit with visible confidence and eye contact.',
    'Close with a confident nod and inviting creator-style recommendation.',
  ];
};

const compileAvatarExecutionAction = (
  action: unknown,
  preferredRanges: string[],
  durationSeconds: number,
  hasProductContext: boolean,
) => {
  if (Array.isArray(action)) {
    const normalized = action
      .map((entry, index) => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const description = cleanAvatarExecutionField(record.description);
        if (!description) return null;
        const timeValue = typeof record.time === 'string' ? record.time : '';
        const fallbackRanges = preferredRanges.length > 0
          ? preferredRanges
          : buildAvatarExecutionTimeRanges(action.length, durationSeconds);
        return {
          time: normalizeAvatarTimeKey(timeValue, index, fallbackRanges),
          description,
        };
      })
      .filter(Boolean);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (typeof action === 'string' && cleanAvatarExecutionField(action)) {
    const actionText = cleanAvatarExecutionField(action);
    const ranges = preferredRanges.length > 0
      ? preferredRanges
      : buildAvatarExecutionTimeRanges(Math.min(Math.max(2, durationSeconds >= 8 ? 4 : 3), durationSeconds), durationSeconds);
    const beats = getAvatarExecutionActionBeats(hasProductContext);
    return ranges.map((time, index) => ({
      time,
      description: index === 0
        ? `${actionText} ${beats[Math.min(index, beats.length - 1)]}`.trim()
        : beats[Math.min(index, beats.length - 1)],
    }));
  }

  const ranges = preferredRanges.length > 0
    ? preferredRanges
    : buildAvatarExecutionTimeRanges(Math.min(Math.max(2, durationSeconds >= 8 ? 4 : 3), durationSeconds), durationSeconds);
  const beats = getAvatarExecutionActionBeats(hasProductContext);
  return ranges.map((time, index) => ({
    time,
    description: beats[Math.min(index, beats.length - 1)],
  }));
};

const getAvatarVideoReferenceImages = (
  referenceImageUrls: string[],
  durationSeconds?: number
) => {
  const uniqueUrls = referenceImageUrls.filter((url, index, all) => (
    typeof url === 'string' &&
    url.trim().length > 0 &&
    all.indexOf(url) === index
  ));

  if (uniqueUrls.length === 0) return [];
  if ((durationSeconds || 0) > 15 && uniqueUrls.length >= 2) {
    return uniqueUrls.slice(0, 2);
  }

  return uniqueUrls.slice(0, 1);
};

const parseAvatarPromptGenerationResponse = (data: unknown): AvatarPromptResponseShape | null => {
  const rawContent = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;

  if (rawContent !== null && typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    return rawContent as AvatarPromptResponseShape;
  }

  return extractOpenRouterJsonContent<AvatarPromptResponseShape>(rawContent);
};

const getAvatarDialogEntries = (dialog: unknown) => {
  if (!dialog || typeof dialog !== 'object' || Array.isArray(dialog)) {
    return [] as Array<[string, string]>;
  }

  return Object.entries(dialog as Record<string, unknown>)
    .map(([time, content]) => [time, cleanAvatarExecutionField(content)] as const)
    .filter(([, content]) => content.length > 0)
    .sort(([timeA], [timeB]) => {
      const startA = Number((timeA.match(/^(\d+)/) || [])[1] || 0);
      const startB = Number((timeB.match(/^(\d+)/) || [])[1] || 0);
      return startA - startB;
    });
};

const flattenAvatarDialogText = (dialog: unknown) => {
  if (typeof dialog === 'string') {
    return cleanAvatarExecutionField(dialog);
  }

  const entries = getAvatarDialogEntries(dialog);
  return entries.map(([, content]) => content).join(' ').trim();
};

const normalizeAvatarGeneratedDialog = (
  dialog: unknown,
  durationSeconds: number,
  fallbackText: string
) => {
  const structuredDialog = sanitizeAvatarStructuredDialog(dialog);
  if (Object.keys(structuredDialog).length > 0) {
    return structuredDialog;
  }

  if (fallbackText) {
    return compileAvatarExecutionDialog(fallbackText, durationSeconds);
  }

  return {};
};

const normalizeAvatarGeneratedAction = (
  action: unknown,
  dialogMap: AvatarPromptDialogMap,
  durationSeconds: number,
  hasProductContext: boolean
) => {
  const structuredAction = sanitizeAvatarStructuredAction(action);
  if (structuredAction.length > 0) {
    return structuredAction;
  }

  return compileAvatarExecutionAction(
    action,
    Object.keys(dialogMap),
    durationSeconds,
    hasProductContext
  );
};

const normalizeAvatarGeneratedScenePrompt = (input: {
  prompt: AvatarScenePromptShape | undefined;
  sceneIndex: number;
  resolvedLanguage: LanguageCode;
  model: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27';
  hasProductContext: boolean;
  fallbackDialogueText: string;
}) => {
  const prompt = input.prompt || {};
  const rawDialogText = flattenAvatarDialogText(prompt.dialog) || cleanAvatarExecutionField(input.fallbackDialogueText);
  const estimatedDuration = rawDialogText
    ? estimateAvatarAdsSingleSceneDurationSeconds(rawDialogText, input.model, input.resolvedLanguage)
    : 0;
  const durationSeconds = normalizeAvatarPromptDuration(
    prompt.duration_seconds ?? estimatedDuration,
    input.model
  );
  const dialog = normalizeAvatarGeneratedDialog(prompt.dialog, durationSeconds, rawDialogText);
  const action = normalizeAvatarGeneratedAction(prompt.action, dialog, durationSeconds, input.hasProductContext);
  const inferredGender = inferAvatarVoiceGender(prompt.voice_type, prompt.subject);

  return {
    scene: input.sceneIndex,
    prompt: {
      ...prompt,
      subject: cleanAvatarExecutionField(prompt.subject),
      context_environment: cleanAvatarExecutionField(prompt.context_environment),
      action,
      style: cleanAvatarExecutionField(prompt.style),
      camera_motion_positioning: cleanAvatarExecutionField(prompt.camera_motion_positioning),
      composition: cleanAvatarExecutionField(prompt.composition),
      ambiance_color_lighting: cleanAvatarExecutionField(prompt.ambiance_color_lighting),
      audio: cleanAvatarExecutionField(prompt.audio),
      dialog,
      voice_type: cleanAvatarExecutionField(prompt.voice_type) || buildAvatarVoiceType(input.resolvedLanguage, inferredGender),
      duration_seconds: durationSeconds,
      resolved_spoken_language: input.resolvedLanguage,
    }
  };
};

const normalizeAvatarPromptGenerationResult = (input: {
  parsed: AvatarPromptResponseShape;
  languageCode: LanguageCode;
  languageName: string;
  model: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27';
  avatarName?: string | null;
  productName?: string | null;
  fallbackScriptSource?: string | null;
  hasProductContext: boolean;
}) => {
  const normalizedScenes = (input.parsed.scenes || [])
    .map((scene, index) => normalizeAvatarGeneratedScenePrompt({
      prompt: scene?.prompt,
      sceneIndex: Number(scene?.scene) || index + 1,
      resolvedLanguage: input.languageCode,
      model: input.model,
      hasProductContext: input.hasProductContext,
      fallbackDialogueText: input.fallbackScriptSource || ''
    }))
    .filter((scene) => scene.prompt.dialog && Object.keys(scene.prompt.dialog).length > 0);

  if (normalizedScenes.length === 0) {
    return null;
  }

  const imagePrompt = ensureAvatarImagePromptMentions({
    imagePrompt: typeof input.parsed.image_prompt === 'string' ? input.parsed.image_prompt : '',
    avatarName: input.avatarName,
    productName: input.productName
  });

  const plannedSceneDurations = normalizedScenes.map((scene) => normalizeAvatarPromptDuration(scene.prompt.duration_seconds, input.model));
  const plannedTotalDurationSeconds = plannedSceneDurations.reduce((sum, value) => sum + value, 0);

  return {
    image_prompt: imagePrompt,
    language: input.languageName,
    resolved_spoken_language: input.languageCode,
    planned_total_duration_seconds: plannedTotalDurationSeconds,
    planned_scene_duration_seconds: plannedSceneDurations,
    scenes: normalizedScenes,
  };
};

// Fallback product analysis for temporary products (no database record)
async function analyzeProductImageOnly(imageUrl: string): Promise<string> {
  const systemText = `Analyze this product image and describe:
1. Product type and category
2. Key visual features (color, design, materials)

Provide a concise product name (max 80 characters).`;

  const messages = [
    {
      role: 'system',
      content: systemText
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Name this product:' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ];

  const requestedModel = process.env.OPENROUTER_MODEL || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash';

  const data = await sendOpenRouterChat({
    model: requestedModel,
    messages,
    max_tokens: 200,
    temperature: 0.2
  }, {
    maxRetries: 5,
    timeoutMs: 60000,
    httpReferer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    xTitle: 'Flowtra'
  });

  return extractOpenRouterTextContent(data.choices?.[0]?.message?.content) || 'Product name unavailable';
}

// Generate prompts without retry logic
async function generatePrompts(
  productContext: {
    product_name?: string;
    talking_head_script?: string;
  } | null,
  personImageUrl: string,
  productImageUrl: string | null,
  videoDurationSeconds: number,
  language?: string,
  userDialogue?: string,
  options?: { talkingHeadMode?: boolean; model?: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27'; avatarName?: string | null }
): Promise<Record<string, unknown>> {
  const result = await _generatePromptsInternal(
    productContext,
    personImageUrl,
    productImageUrl,
    videoDurationSeconds,
    language,
    userDialogue,
    options
  );
  return result;
}

// Generate prompts based on product context and character description (internal implementation)
async function _generatePromptsInternal(
  productContext: {
    product_name?: string;
    talking_head_script?: string;
  } | null,
  personImageUrl: string,
  productImageUrl: string | null,
  videoDurationSeconds: number,
  language?: string,
  userDialogue?: string,
  options?: { talkingHeadMode?: boolean; model?: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27'; avatarName?: string | null }
): Promise<Record<string, unknown>> {
  // Get language name for prompts
  const languageCode = resolveAvatarSpokenLanguage({
    scriptSource: userDialogue,
    configuredLanguage: language || 'en',
  });
  const languageName = getLanguagePromptName(languageCode);
  const isTalkingHeadMode = options?.talkingHeadMode ?? false;
  const resolvedModel = options?.model === 'kling_3'
    ? 'kling_3'
    : options?.model === 'seedance_2'
      ? 'seedance_2'
      : options?.model === 'wan_27'
        ? 'wan_27'
        : DEFAULT_VIDEO_MODEL;
  const estimatedDialogueDurationSeconds = userDialogue
    ? estimateAvatarAdsDialogueSeconds(userDialogue, resolvedModel, languageCode)
    : 0;
  const supportsFlexibleDuration = true;
  const targetSceneDuration = getAvatarAdsTargetSceneDuration(resolvedModel);
  const modelSceneDurationRule = getAvatarAdsModelSceneDurationRule(resolvedModel);
  const videoScenes = supportsFlexibleDuration
    ? (
        userDialogue && estimatedDialogueDurationSeconds > 0
          ? Math.max(1, Math.ceil(estimatedDialogueDurationSeconds / targetSceneDuration))
          : Math.max(1, Math.ceil(videoDurationSeconds / targetSceneDuration))
      )
    : Math.max(1, Math.ceil(videoDurationSeconds / targetSceneDuration));

  const dialogueLengthGuidance = generateDialogueLengthGuidance(videoScenes, targetSceneDuration, languageCode);

  if (!personImageUrl) {
    throw new Error('Person image URL is required for prompt generation');
  }

  if (!isTalkingHeadMode) {
    if (!productImageUrl) {
      throw new Error('Product image URL is required for product-based character ads');
    }
  }

 const talkHeadContext = userDialogue
    ? `The user provided this custom script: "${userDialogue.replace(/"/g, '\\"')}"

CRITICAL SCRIPT SPLITTING RULES:
1. Split the script across ${videoScenes} scene(s) only if needed for natural spoken timing
2. Each scene should land naturally ${modelSceneDurationRule}
3. Split at natural phrase/sentence boundaries ONLY
4. Preserve complete thoughts - do NOT split mid-concept or mid-solution
   - Example: Keep "problem + solution" together in one scene
   - Do NOT separate "I'm invisible to AI?" from "AI Bot Manager fixes this in ONE CLICK"
5. If the full script fits naturally in one scene, keep it in one scene
6. Do NOT simply divide words evenly
7. Preserve all key phrases and main ideas from the user's script

EXAMPLES OF CORRECT SPLITTING:
- ✅ Scene 1 (18 words): "ChatGPT can't see my website? I'm invisible to AI? AI Bot Manager fixes this in ONE CLICK."
- ❌ Scene 1 (12 words): "ChatGPT can't see my website? I'm invisible to AI?" [WRONG - incomplete thought]`
    : productContext?.talking_head_script
      ? `Use this talking head context to guide the monologue: ${productContext.talking_head_script}`
      : 'No script provided. Create an authentic, upbeat personal message where the talent shares a helpful insight or story directly to camera.';

  const commonStructuredRules = `
Return only a schema-compliant structured prompt payload for Avatar Ads.

Core instruction:
- You are an expert UGC product-selling video prompt writer.
- Use the selected language, the provided images, and the provided dialogue/script as your full context.
- Write the final prompt content directly. Do not output generic filler or abstract placeholders.

Language rules:
- The selected spoken language is ${languageCode} (${languageName}).
- Preserve this language exactly in both "language" and "resolved_spoken_language".
- If the selected language is zh_yue, it must remain Cantonese end-to-end.
- Dialog and voice semantics must match ${languageName}.

Structure rules:
- Keep the existing JSON shape exactly.
- "action" must be an array of 2 to 4 meaningful action beats.
- "dialog" must be an object keyed by natural time ranges such as "0-2s", "2-4s".
- Group the script into semantic speaking beats, not punctuation fragments.
- If the script fits naturally in one scene, keep it in one scene.
- Split across ${videoScenes} scene(s) only when natural spoken timing requires it.
- Each scene should land naturally ${modelSceneDurationRule}.

Content rules:
- Base all visual writing on the images and user script.
- Write concrete, shootable UGC details.
- Avoid generic stock phrases and repeated beats.
- "voice_type" must match the perceived person in the image and the selected language.

${dialogueLengthGuidance}`;

  const productSystemPrompt = `
Generate the final structured prompt for a UGC product-selling avatar video.

Context you will receive:
- one person image
- one product image
- the selected spoken language
- the user dialogue/script
- optional product context

Your job:
- use the image context and script directly
- return the final JSON scene prompt payload
- make it feel like a real UGC product-selling video prompt, not a template

${productContext?.product_name ? `Product context: ${productContext.product_name}` : ''}
${userDialogue ? `User script: "${userDialogue.replace(/"/g, '\\"')}"` : ''}

${commonStructuredRules}`.trim();

  const talkingHeadSystemPrompt = `
Generate the final structured prompt for a direct-to-camera UGC talking-head avatar video.

Context you will receive:
- one person image
- the selected spoken language
- the user dialogue/script or talking-head context

Your job:
- use the image context and script directly
- return the final JSON scene prompt payload
- make it feel like a real UGC talking-head prompt, not a template

${talkHeadContext}

${commonStructuredRules}`.trim();

  const systemPrompt = isTalkingHeadMode ? talkingHeadSystemPrompt : productSystemPrompt;

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: isTalkingHeadMode
            ? `Generate prompts for this character speaking directly to camera.\nPERSON IMAGE: Analyze for gender, age, and style.\n${productContext?.talking_head_script ? `Talking Head Context: ${productContext.talking_head_script}` : ''}`
            : `Generate prompts for this character and product:\n\nPERSON IMAGE: Analyze for gender, age, style\nPRODUCT IMAGE: Identify the product\n\n${productContext?.product_name ? `Product Name: ${productContext.product_name}` : ''}`
        },
        { type: 'image_url', image_url: { url: personImageUrl } },
        ...(!isTalkingHeadMode && productImageUrl ? [{ type: 'image_url', image_url: { url: productImageUrl } }] : [])
      ]
    }
  ];

  const data = await sendOpenRouterChat({
    model: process.env.OPENROUTER_MODEL || process.env.AI_GATEWAY_MODEL || 'google/gemini-2.5-flash',
    messages,
    response_format: AVATAR_PROMPT_RESPONSE_FORMAT,
    max_tokens: 2000,
    temperature: 0.3
  }, {
    maxRetries: 5,
    timeoutMs: 60000,
    httpReferer: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    xTitle: 'Flowtra'
  });
  try {
    const parsed = parseAvatarPromptGenerationResponse(data);

    if (!parsed) {
      throw new Error('AI did not return valid structured prompt data');
    }
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      throw new Error('AI did not return scenes array');
    }

    // Ensure no scene 0 (scenes start from 1)
    const hasScene0 = parsed.scenes.some((s) => s && Number(s.scene) === 0);
    if (hasScene0) {
      parsed.scenes = parsed.scenes.filter((s) => s && Number(s.scene) !== 0);
    }

    const scriptSource = userDialogue
      || productContext?.talking_head_script
      || parsed.scenes
        .map((scene) => flattenAvatarDialogText(scene.prompt?.dialog))
        .filter(Boolean)
        .join(' ');
    const normalized = normalizeAvatarPromptGenerationResult({
      parsed,
      languageCode,
      languageName,
      model: resolvedModel,
      avatarName: options?.avatarName,
      productName: productContext?.product_name,
      fallbackScriptSource: scriptSource,
      hasProductContext: !isTalkingHeadMode,
    });

    if (normalized) {
      return normalized;
    }

    const legacyFallback = buildAvatarGeneratedPrompts({
      imagePrompt: parsed.image_prompt,
      scriptSource,
      existingScenes: parsed.scenes.map((scene, index) => ({
        sceneIndex: Number(scene.scene) || index + 1,
        prompt: scene.prompt || {}
      })),
      language: languageCode,
      model: resolvedModel,
      avatarName: options?.avatarName,
      productName: productContext?.product_name
    });

    return {
      ...legacyFallback.generatedPrompts,
      language: languageName,
      resolved_spoken_language: languageCode,
      scenes: legacyFallback.scenes.map((scene) => ({
        scene: scene.sceneIndex,
        prompt: scene.prompt
      }))
    };
  } catch (error) {
    console.error('Failed to parse Gemini response:', data.choices?.[0]?.message?.content);
    console.error('Parse error:', error);
    throw new Error('Failed to parse generated prompts from Gemini');
  }
}

function getImageModelParameters(customImageSize?: string, videoAspectRatio?: string): Record<string, unknown> {
  // Map UI-friendly sizes to ratio strings.
  const mapUiToRatio = (val?: string, fallbackAspect?: string) => {
    switch (val) {
      case 'square':
      case 'square_hd':
      case '1:1':
        return '1:1';
      case 'portrait_16_9':
      case '9:16':
        return '9:16';
      case 'landscape_16_9':
      case '16:9':
        return '16:9';
      case 'portrait_4_3':
      case '3:4':
        return '3:4';
      case 'landscape_4_3':
      case '4:3':
        return '4:3';
      case 'portrait_3_2':
      case '2:3':
        return '2:3';
      case 'landscape_3_2':
      case '3:2':
        return '3:2';
      case 'portrait_5_4':
      case '4:5':
        return '4:5';
      case 'landscape_5_4':
      case '5:4':
        return '5:4';
      case 'landscape_21_9':
      case '21:9':
        return '21:9';
      case 'auto':
      case undefined:
      case '':
        // Choose based on video aspect ratio if provided
        if (fallbackAspect === '9:16') return '9:16';
        if (fallbackAspect === '16:9') return '16:9';
        return undefined;
      default:
        return undefined;
    }
  };

  const ratio = mapUiToRatio(customImageSize, videoAspectRatio) || '1:1';
  return {
    aspect_ratio: ratio,
    resolution: '1K',
    output_format: 'png',
    google_search: false
  };
}

// KIE Platform API integration
async function generateImageWithKIE(
  prompt: Record<string, unknown>,
  referenceImages: string[],
  customImageSize?: string,
  videoAspectRatio?: string
): Promise<{ taskId: string }> {
  const limitedReferenceImages = referenceImages.slice(0, 8);
  const modelParams = getImageModelParameters(customImageSize, videoAspectRatio);

  let promptValue: string;
  if (prompt && typeof prompt.image_prompt === 'string') {
    promptValue = prompt.image_prompt;
  } else if (prompt && typeof prompt.prompt === 'string') {
    promptValue = prompt.prompt;
  } else {
    promptValue = JSON.stringify(prompt);
  }
  promptValue = compileAvatarAdsMentionText(promptValue);

  // Construct webhook callback URL (webhook-first architecture with polling fallback)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const callBackUrl = siteUrl ? `${siteUrl}/api/avatar-ads/webhooks/image` : undefined;

  const payload = {
    model: NON_AGENT_IMAGE_MODEL,
    input: {
      prompt: promptValue,
      image_input: limitedReferenceImages,
      ...modelParams
    },
    ...(callBackUrl && { callBackUrl }) // Add callBackUrl only if NEXT_PUBLIC_SITE_URL is set
  };

  const payloadInput = payload.input as Record<string, unknown>;
  console.log('[generateImageWithKIE] Request payload summary:', {
    model: payload.model,
    inputFields: Object.keys(payloadInput),
    usesImageInput: Object.prototype.hasOwnProperty.call(payloadInput, 'image_input'),
    usesImageUrls: Object.prototype.hasOwnProperty.call(payloadInput, 'image_urls'),
    aspect_ratio: payloadInput.aspect_ratio ?? null,
    resolution: payloadInput.resolution ?? null,
    google_search: payloadInput.google_search ?? null,
    quality: payloadInput.quality ?? null
  });

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  }, 5, 30000);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('KIE API error response:', errorText);
    throw new Error(`KIE image generation failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    console.error('KIE API returned error code:', data.code, 'message:', data.msg);
    throw new Error(`KIE image generation failed: ${data.msg}`);
  }

  return { taskId: data.data.taskId };
}

export async function generateVideoWithKIE(
  prompt: Record<string, unknown>,
  referenceImageUrls: string[],
  videoAspectRatio?: '16:9' | '9:16',
  language?: string,
  options?: {
    hasProductContext?: boolean;
    model?: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27';
    durationSeconds?: number;
    avatarGender?: 'male' | 'female' | null;
    sceneNumber?: number;
    totalScenes?: number;
  }
): Promise<{ taskId: string }> {
  // ✅ Validate prompt parameter
  if (!prompt || typeof prompt !== 'object') {
    console.error('❌ Invalid prompt:', prompt);
    throw new Error(`Invalid prompt: expected object, got ${typeof prompt}`);
  }

  // ✅ Extract video_prompt text from prompt object AND all metadata
  let videoPromptText: string;
  let isStructuredExecutionPrompt = false;

  if (typeof prompt === 'string') {
    // If already a string, use it directly
    videoPromptText = prompt;
  } else if (prompt && typeof prompt === 'object') {
    // Extract all fields from the scene prompt object
    const promptObj = prompt as {
      voice_type?: string;
      // New structured fields
      subject?: string;
      context_environment?: string;
      action?: unknown;
      style?: string;
      camera_motion_positioning?: string;
      composition?: string;
      ambiance_color_lighting?: string;
      audio?: string;
      dialog?: unknown;
      [key: string]: unknown;
    };

    // Check if we have the new structured fields (and if the 'video_prompt' is absent)
    const hasNewStructuredFields = !!(promptObj.subject || promptObj.context_environment || promptObj.action || promptObj.dialog || promptObj.style || promptObj.camera_motion_positioning || promptObj.composition || promptObj.ambiance_color_lighting || promptObj.audio);

    if (hasNewStructuredFields) {
      // Construct prompt from new fields
      videoPromptText = buildAvatarAdsVideoExecutionPrompt(promptObj, {
        ...options,
        durationSeconds: options?.durationSeconds,
        avatarGender: options?.avatarGender || inferAvatarVoiceGender(promptObj.voice_type, promptObj.subject)
      });
      isStructuredExecutionPrompt = true;
    } else {
      // Fallback to old logic (if the prompt doesn't have the new structured fields)
      // This path is for backwards compatibility and should eventually be phased out.
      // If promptObj is missing expected keys, it implies old format or malformed.
      const oldPromptObj = prompt as {
        video_prompt?: string;
        voice_type?: string;
        camera?: string;
        emotion?: string;
        setting?: string;
        camera_movement?: string;
        [key: string]: unknown;
      };

      const videoPrompt = compileAvatarAdsMentionText(oldPromptObj.video_prompt || '');
      const voiceType = oldPromptObj.voice_type || '';
      const camera = oldPromptObj.camera || '';
      const emotion = oldPromptObj.emotion || '';
      const setting = oldPromptObj.setting || '';
      const cameraMovement = oldPromptObj.camera_movement || '';

      const promptParts: string[] = [];
      if (videoPrompt) promptParts.push(videoPrompt);

      const metadataParts: string[] = [];
      if (voiceType) metadataParts.push(`Voice: ${voiceType}`);
      if (emotion) metadataParts.push(`Emotion: ${emotion}`);
      if (setting) metadataParts.push(`Setting: ${setting}`);
      if (camera) metadataParts.push(`Camera: ${camera}`);
      if (cameraMovement && cameraMovement !== 'fixed') metadataParts.push(`Movement: ${cameraMovement}`);

      if (metadataParts.length > 0) promptParts.push('\n\n' + metadataParts.join(', '));
      videoPromptText = promptParts.join('');
    }

    // Defensive check: if still empty
    if (!videoPromptText || videoPromptText.trim() === '') {
      console.error('❌ Failed to extract video prompt text from prompt object:', prompt);
      throw new Error('Invalid prompt: constructed video prompt is empty');
    }
  } else {
    throw new Error(`Invalid prompt format: ${typeof prompt}`);
  }

  const resolvedModel = options?.model === 'kling_3'
    ? 'kling_3'
    : options?.model === 'seedance_2'
      ? 'seedance_2'
      : options?.model === 'wan_27'
        ? 'wan_27'
        : DEFAULT_VIDEO_MODEL;
  const basePrompt = videoPromptText.trim();
  const promptLanguage = language || (
    typeof (prompt as { resolved_spoken_language?: unknown }).resolved_spoken_language === 'string'
      ? (prompt as { resolved_spoken_language?: string }).resolved_spoken_language
      : null
  );
  const lang = resolveAvatarSpokenLanguage({
    scriptSource: typeof (prompt as { dialog?: unknown }).dialog === 'string'
      ? (prompt as { dialog?: string }).dialog
      : null,
    configuredLanguage: promptLanguage || language || 'en',
  });
  const languageName = getLanguagePromptName(lang);
  if (!languageName) {
    throw new Error(`Invalid language code: ${lang}`);
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const callBackUrl = siteUrl ? `${siteUrl}/api/avatar-ads/webhooks/video` : undefined;
  const finalPrompt = isStructuredExecutionPrompt
    ? basePrompt
    : `Spoken Language: ${languageName}\n\n${basePrompt}`;
  const durationSeconds = (() => {
    const inputDuration = options?.durationSeconds && options.durationSeconds > 0
      ? options.durationSeconds
      : (resolvedModel === 'kling_3'
          ? KLING_MAX_TASK_DURATION_SECONDS
          : resolvedModel === 'wan_27'
            ? 5
            : SEEDANCE_MAX_TASK_DURATION_SECONDS);
    const minDuration = resolvedModel === 'kling_3'
      ? 3
      : resolvedModel === 'wan_27'
        ? 2
        : SEEDANCE_MIN_TASK_DURATION_SECONDS;
    const maxDuration = resolvedModel === 'kling_3'
      ? KLING_MAX_TASK_DURATION_SECONDS
      : resolvedModel === 'wan_27'
        ? 15
        : SEEDANCE_MAX_TASK_DURATION_SECONDS;
    return Math.max(minDuration, Math.min(maxDuration, Math.round(inputDuration)));
  })();
  const selectedReferenceImages = getAvatarVideoReferenceImages(referenceImageUrls, durationSeconds);
  const validReferenceUrls = referenceImageUrls.filter(
    (url) => typeof url === 'string' && url.trim().length > 0
  );
  const firstFrameUrl = validReferenceUrls[0];
  const candidateLastFrameUrl = validReferenceUrls.find((url, index) => index > 0 && url !== firstFrameUrl);
  const isFinalScene = (options?.totalScenes || 1) <= 1
    || ((options?.sceneNumber || 1) >= (options?.totalScenes || 1));
  const lastFrameUrl = !isFinalScene && candidateLastFrameUrl ? candidateLastFrameUrl : undefined;

  const requestBody = (() => {
    if (resolvedModel === 'kling_3') {
      return {
        model: 'kling-3.0/video',
        ...(callBackUrl ? { callBackUrl } : {}),
        input: {
          mode: 'std',
          image_urls: selectedReferenceImages,
          prompt: finalPrompt,
          sound: true,
          duration: String(durationSeconds),
          aspect_ratio: '9:16',
          multi_shots: false
        }
      };
    }
    if (resolvedModel === 'wan_27') {
      return {
        model: 'wan/2-7-image-to-video',
        ...(callBackUrl ? { callBackUrl } : {}),
        input: {
          prompt: finalPrompt,
          ...(firstFrameUrl ? { first_frame_url: firstFrameUrl } : {}),
          ...(lastFrameUrl ? { last_frame_url: lastFrameUrl } : {}),
          resolution: '1080p',
          duration: durationSeconds,
          prompt_extend: true,
          watermark: false,
        }
      };
    }
    return {
      model: resolvedModel === 'seedance_2_fast' ? 'bytedance/seedance-2-fast' : 'bytedance/seedance-2',
      ...(callBackUrl ? { callBackUrl } : {}),
      input: {
        prompt: finalPrompt,
        ...(firstFrameUrl ? { first_frame_url: firstFrameUrl } : {}),
        ...(lastFrameUrl ? { last_frame_url: lastFrameUrl } : {}),
        aspect_ratio: '9:16',
        duration: durationSeconds,
        resolution: '720p',
        generate_audio: true,
        web_search: true,
      }
    };
  })();

  const promptInBody = resolvedModel === 'kling_3'
    ? ((requestBody as { input?: { prompt?: string } }).input?.prompt)
    : ((requestBody as { input?: { prompt?: string } }).input?.prompt);

  if (!promptInBody || typeof promptInBody !== 'string' || promptInBody.trim() === '' || promptInBody === '{}') {
    console.error('❌❌❌ CRITICAL: Attempting to call KIE API with empty/invalid prompt!');
    console.error('Request body:', JSON.stringify(requestBody, null, 2));
    throw new Error(`STOPPING WORKFLOW: Cannot call KIE API with empty prompt "${promptInBody}"`);
  }

  const response = await fetchWithRetry('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  }, 5, 30000);

  if (!response.ok) {
    const errorData = await response.text();
    console.error('❌ KIE API error response:', errorData);
    throw new Error(`KIE video generation failed: ${response.status} ${response.statusText} - ${errorData}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    const apiMessage =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.msg === 'string' && data.msg) ||
      (typeof data.error === 'string' && data.error) ||
      (typeof data.error?.message === 'string' && data.error.message) ||
      'Unknown error';

    console.error('❌ KIE API returned error:', {
      code: data.code,
      message: apiMessage,
      raw: data,
    });
    throw new Error(`KIE video generation failed [${data.code}]: ${apiMessage}`);
  }

  return { taskId: data.data.taskId };
}

async function checkKIEImageTaskStatus(taskId: string): Promise<{
  status: string;
  result_url?: string;
  error?: string;
}> {
  const response = await fetchWithRetry(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    }
  }, 5, 30000);

  if (!response.ok) {
    throw new Error(`KIE image task status check failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`KIE image task status check failed: ${data.msg}`);
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'processing' };
  }

  // Normalize state flags and extract URL robustly (same logic as other features)
  const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;
  const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;

  let resultJson: Record<string, unknown> = {};
  try {
    resultJson = JSON.parse(taskData.resultJson || '{}');
  } catch {
    resultJson = {};
  }

  const directUrls = Array.isArray((resultJson as { resultUrls?: string[] }).resultUrls)
    ? (resultJson as { resultUrls?: string[] }).resultUrls
    : undefined;
  const responseUrls = Array.isArray(taskData.response?.resultUrls)
    ? (taskData.response.resultUrls as string[])
    : undefined;
  const flatUrls = Array.isArray(taskData.resultUrls)
    ? (taskData.resultUrls as string[])
    : undefined;
  const result_url = (directUrls || responseUrls || flatUrls)?.[0];

  const stateLower = state?.toLowerCase();
  const isSuccess = (stateLower === 'success') || successFlag === 1 || (!!result_url && (stateLower === undefined));
  const isFailed = (stateLower === 'failed' || stateLower === 'fail' || stateLower === 'error') || successFlag === 2 || successFlag === 3;

  if (isSuccess) {
    return { 
      status: 'completed', 
      result_url,
      error: undefined
    };
  }
  if (isFailed) {
    return { 
      status: 'failed', 
      result_url: undefined,
      error: taskData.failMsg || taskData.errorMessage || 'Image generation failed'
    };
  }

  // Still processing
  return { status: 'processing' };
}

export async function checkKIEVideoTaskStatus(
  taskId: string,
  model: 'seedance_2_fast' | 'seedance_2' | 'kling_3' | 'wan_27' = DEFAULT_VIDEO_MODEL
): Promise<{
  status: string;
  result_url?: string;
  error?: string;
  errorCode?: string;  // NEW: Add error code for retry logic
  isRetryable?: boolean; // NEW: Flag for retryable errors
}> {
  const response = await fetchWithRetry(
    `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      }
    },
    5,
    30000
  );

  if (!response.ok) {
    throw new Error(`KIE video task status check failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.code !== 200) {
    throw new Error(`KIE video task status check failed: ${data.msg || 'Unknown error'}`);
  }

  const taskData = data.data;
  if (!taskData) {
    return { status: 'processing' };
  }

  // Use the same robust logic as other features - prioritize successFlag
  const successFlag: number | undefined = typeof taskData.successFlag === 'number' ? taskData.successFlag : undefined;
  const state: string | undefined = typeof taskData.state === 'string' ? taskData.state : undefined;

  // NEW: Extract failCode for server error detection
  const failCode: string | undefined = typeof taskData.failCode === 'string' ? taskData.failCode : undefined;
  const errorCode: string | undefined = typeof taskData.errorCode === 'number' ? String(taskData.errorCode) : failCode;

  // Extract video URL from multiple possible locations
  let result_url: string | undefined;
  if (taskData.outputUrl) {
    result_url = taskData.outputUrl;
  } else if (taskData.response?.resultUrls?.[0]) {
    result_url = taskData.response.resultUrls[0];
  } else if (Array.isArray(taskData.resultUrls) && taskData.resultUrls[0]) {
    result_url = taskData.resultUrls[0];
  }

  if (successFlag === 1) {
    return {
      status: 'completed',
      result_url,
      error: undefined
    };
  } else if (successFlag === 2 || successFlag === 3) {
    const errorMessage = taskData.errorMessage || taskData.failureReason || 'Video generation failed';

    // NEW: Detect server errors (retryable)
    const isServerError = errorCode === '500' || failCode === '500';

    // NEW: Detect content policy errors (already retried by existing logic)
    const isContentPolicyError = errorMessage && (
      errorMessage.toLowerCase().includes('content polic') ||
      errorMessage.toLowerCase().includes('safety check failed') ||
      errorMessage.toLowerCase().includes('violating content policies')
    );

    return {
      status: 'failed',
      result_url: undefined,
      error: errorMessage,
      errorCode: errorCode, // NEW: Pass error code
      isRetryable: isServerError && !isContentPolicyError // NEW: Server errors are retryable
    };
  } else if (state === 'success' || state === 'SUCCESS') {
    return {
      status: 'completed',
      result_url,
      error: undefined
    };
  } else if (state === 'failed' || state === 'fail' || state === 'error') {
    const errorMessage = taskData.errorMessage || taskData.failureReason || 'Video generation failed';
    const isServerError = errorCode === '500' || failCode === '500';
    const isContentPolicyError = errorMessage && (
      errorMessage.toLowerCase().includes('content polic') ||
      errorMessage.toLowerCase().includes('safety check failed') ||
      errorMessage.toLowerCase().includes('violating content policies')
    );

    return {
      status: 'failed',
      result_url: undefined,
      error: errorMessage,
      errorCode: errorCode,
      isRetryable: isServerError && !isContentPolicyError
    };
  } else {
    // Still processing (waiting, running, or other states)
    return { status: 'processing' };
  }
}

export async function processAvatarAdsProject(
  project: AvatarAdsProject,
  step: string,
  options?: { customDialogue?: string }
): Promise<ProcessResult> {
  const supabase = getSupabaseAdmin();

  try {
    switch (step) {
      case 'generate_prompts': {
        // Step 2: Generate prompts for all scenes
        // Extract product context from project (typed safely)
        let productContext = project.product_context;

        const hasProductImages = Array.isArray(project.product_image_urls) && project.product_image_urls.length > 0;
        const talkingHeadMode = !hasProductImages;

        // Fallback: analyze temp product if no context
        if (!productContext && hasProductImages) {
          const productName = await analyzeProductImageOnly(project.product_image_urls[0]);
          productContext = {
            product_name: productName.trim()
          };

          await supabase.from('avatar_ads_projects')
            .update({ product_context: productContext })
            .eq('id', project.id);
        }

        if ((!productContext || !productContext.talking_head_script) && talkingHeadMode) {
          const fallbackScript = project.custom_dialogue?.trim();
          productContext = {
            talking_head_script: fallbackScript
              ? `Talking head delivery. Have the character speak directly to camera and read this script verbatim: ${fallbackScript}`
              : 'Talking head delivery. Have the character speak directly to camera about their expertise or story with no props.'
          };
        }

        // Validate person image URLs
        if (!project.person_image_urls || project.person_image_urls.length === 0) {
          throw new Error('Person image URLs are required but not found in project');
        }

        const personImageUrl = project.person_image_urls[0];
        if (!personImageUrl || typeof personImageUrl !== 'string') {
          throw new Error(`Invalid person image URL: ${JSON.stringify(personImageUrl)}`);
        }

        let productImageUrl: string | null = null;
        if (!talkingHeadMode) {
          if (!project.product_image_urls || project.product_image_urls.length === 0) {
            throw new Error('Product image URLs are required but not found in project');
          }

          productImageUrl = project.product_image_urls[0];
          if (!productImageUrl || typeof productImageUrl !== 'string') {
            throw new Error(`Invalid product image URL: ${JSON.stringify(productImageUrl)}`);
          }
        }

        // ✅ Fix Bug 2: Direct Gemini analysis - no separate person analysis or gender detection
        const prompts = await generatePrompts(
          productContext as { product_name?: string; talking_head_script?: string } | null,
          personImageUrl,
          productImageUrl,
          project.video_duration_seconds,
          project.language,
          project.custom_dialogue || undefined,
          {
            talkingHeadMode,
            model: resolveAvatarAdsVideoModel(project),
            avatarName: project.avatar_name
          }
        );
        const resolvedVideoModel = resolveAvatarAdsVideoModel(project);
        const resolvedSpokenLanguage = typeof (prompts as { resolved_spoken_language?: unknown }).resolved_spoken_language === 'string'
          ? (prompts as { resolved_spoken_language?: string }).resolved_spoken_language
          : project.language;
        const plannedDurationSeconds = getAvatarPlannedTotalDurationSeconds(
          prompts as Record<string, unknown>,
          resolvedVideoModel,
          project.video_duration_seconds,
          resolvedSpokenLanguage
        );
        const plannedCreditsCost = getGenerationCost(
          resolvedVideoModel,
          String(plannedDurationSeconds)
        );

        // Create scene records (video scenes only, starting from 1)
        const sceneRecords = [];

        // Only create video scenes (no scene 0 anymore)
        const scenes = getAvatarPromptScenes(prompts as Record<string, unknown>);
        for (let i = 0; i < scenes.length; i++) {
          sceneRecords.push({
            project_id: project.id,
            scene_number: i + 1, // Start from 1, not 0
            scene_prompt: scenes[i].prompt,
            status: 'pending'
            // scene_type removed (all scenes are videos now)
          });
        }

        // Insert scene records
        const { error: sceneError } = await supabase
          .from('avatar_ads_scenes')
          .insert(sceneRecords);

        if (sceneError) throw sceneError;

        // Update project with prompts and stop at edit-ready state
        const { data: updatedProject, error } = await supabase
          .from('avatar_ads_projects')
          .update({
            generated_prompts: prompts,
            image_prompt: (prompts as { image_prompt?: string }).image_prompt, // Store project-level image prompt
            language: typeof resolvedSpokenLanguage === 'string' ? resolvedSpokenLanguage : project.language,
            video_duration_seconds: plannedDurationSeconds,
            credits_cost: plannedCreditsCost,
            status: 'awaiting_review',
            current_step: 'reviewing',
            progress_percentage: 60,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        // No event recording

        return {
          project: updatedProject,
          message: 'Prompts generated successfully, project is ready for manual edit',
          nextStep: undefined
        };
      }

      case 'generate_image': {
        // Step 3: Generate project-level cover image using KIE (not scene-specific anymore)
        if (!project.image_prompt) {
          throw new Error('Image prompt not found in project');
        }

        if (project.generated_image_url) {
          // Already generated, keep manual flow at edit state
          return {
            project,
            message: 'Cover image already generated',
            nextStep: undefined
          };
        }

        const referenceImages = [...project.person_image_urls, ...project.product_image_urls];

        // Use project-level image_prompt instead of scene 0 prompt
        const { taskId } = await generateImageWithKIE(
          { prompt: project.image_prompt } as Record<string, unknown>,
          referenceImages,
          project.image_size,
          project.video_aspect_ratio
        );

        // Update project only (no scene updates since scene 0 doesn't exist)
        const { data: updatedProject, error } = await supabase
          .from('avatar_ads_projects')
          .update({
            kie_image_task_id: taskId,
            status: 'generating_image',
            progress_percentage: 50,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        // No event recording

        return {
          project: updatedProject,
          message: 'Cover image generation started',
          nextStep: 'check_image_status'
        };
      }

      case 'check_image_status': {
        // Check KIE image generation status
        if (!project.kie_image_task_id) {
          throw new Error('Image task ID not found');
        }

        const status = await checkKIEImageTaskStatus(project.kie_image_task_id);

        if (status.status === 'completed' && status.result_url) {
          // Image generation completed
          const { data: updatedProject, error } = await supabase
            .from('avatar_ads_projects')
            .update({
              generated_image_url: status.result_url,
              status: 'awaiting_review', // Changed from generating_videos to awaiting_review
              current_step: 'reviewing', // Changed from generating_videos to reviewing
              progress_percentage: 60,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id)
            .select()
            .single();

          if (error) throw error;

          // No scene 0 to update anymore - cover image is project-level

          // No event recording

          return {
            project: updatedProject,
            message: 'Cover image generation completed, awaiting user review',
            nextStep: undefined // Stop automatic progression
          };
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'Image generation failed');
        }

        // Still processing
        return {
          project,
          message: 'Cover image generation in progress'
        };
      }

      case 'generate_videos': {
        // ===== VERSION 2.0: GENERATION-TIME BILLING =====
        const promptScenes = getAvatarPromptScenes(project.generated_prompts);
        const videoScenes = promptScenes.length;
        const resolvedVideoModel = resolveAvatarAdsVideoModel(project);
        const plannedDurationSeconds = getAvatarPlannedTotalDurationSeconds(
          project.generated_prompts,
          resolvedVideoModel,
          project.video_duration_seconds,
          project.language
        );
        const generationCost = getGenerationCost(resolvedVideoModel, String(plannedDurationSeconds));

        if (videoScenes === 0) {
          throw new Error('No video scenes found in generated prompts.');
        }

        if (
          plannedDurationSeconds !== project.video_duration_seconds ||
          generationCost !== (typeof (project as { credits_cost?: unknown }).credits_cost === 'number'
            ? (project as { credits_cost?: number }).credits_cost
            : null)
        ) {
          const { error: syncError } = await supabase
            .from('avatar_ads_projects')
            .update({
              video_duration_seconds: plannedDurationSeconds,
              credits_cost: generationCost,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id);

          if (syncError) {
            throw syncError;
          }
        }

        // Check if user has enough credits
        const creditCheck = await checkCredits(project.user_id, generationCost);
        if (!creditCheck.success) {
          throw new Error(`Failed to check credits: ${creditCheck.error || 'Credit check failed'}`);
        }

        if (!creditCheck.hasEnoughCredits) {
            throw new Error(
            `Insufficient credits: Need ${generationCost} credits for ${videoScenes} video scenes (${resolvedVideoModel}), have ${creditCheck.currentCredits || 0}`
          );
        }

        // Deduct credits UPFRONT before video generation
        const deductResult = await deductCredits(project.user_id, generationCost);
        if (!deductResult.success) {
          throw new Error(`Failed to deduct credits: ${deductResult.error || 'Credit deduction failed'}`);
        }

        // Record the transaction
        await recordCreditTransaction(
          project.user_id,
          'usage',
          generationCost,
          `Avatar Ads - Video generation (${resolvedVideoModel.toUpperCase()}, ${videoScenes} scenes)`,
          project.id,
          true
        );

        // Store generation cost in a variable for potential refund
        const paidGenerationCost = generationCost;

        // Step 4: Generate video scenes using KIE
        if (!project.generated_image_url) {
          throw new Error('Generated image not found - required for video generation');
        }

        // videoScenes already defined above for billing calculation

        const existingTaskIds = Array.isArray(project.kie_video_task_ids)
          ? project.kie_video_task_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : [];

        if (existingTaskIds.length === videoScenes) {
          const progress = Math.max(project.progress_percentage ?? 0, 70);
          const { data: updatedProject, error: skipUpdateError } = await supabase
            .from('avatar_ads_projects')
            .update({
              kie_video_task_ids: existingTaskIds,
              status: 'generating_videos',
              current_step: 'generating_videos',
              progress_percentage: progress,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id)
            .select()
            .single();

          if (skipUpdateError) throw skipUpdateError;

          return {
            project: updatedProject,
            message: 'Video tasks already exist, moving to status checks',
            nextStep: 'check_videos_status'
          };
        }

        const videoTaskIds = [];
        const plannedSceneDurations = getAvatarPlannedSceneDurations(project.generated_prompts);

        // Start video generation for each scene
        for (let i = 1; i <= videoScenes; i++) {
          const videoPrompt = promptScenes[i - 1]?.prompt as Record<string, unknown> | undefined;

          // ✅ STRICT VALIDATION: Ensure videoPrompt exists and is not empty object
          if (!videoPrompt || typeof videoPrompt !== 'object') {
            console.error(`❌❌❌ Scene ${i}: videoPrompt is ${!videoPrompt ? 'undefined/null' : 'not an object'}!`);
            console.error('Full generated_prompts:', JSON.stringify(project.generated_prompts, null, 2));
            throw new Error(`Scene ${i} prompt not found in generated_prompts - STOPPING WORKFLOW`);
          }

          // Check for structured fields or legacy video_prompt
          const videoPromptObj = videoPrompt as any;
          const hasStructuredFields = !!(videoPromptObj.subject || videoPromptObj.action || videoPromptObj.dialog);
          const hasLegacyPrompt = !!(videoPromptObj.video_prompt && typeof videoPromptObj.video_prompt === 'string' && videoPromptObj.video_prompt.trim() !== '');

          if (!hasStructuredFields && !hasLegacyPrompt) {
             console.error(`❌❌❌ Scene ${i}: Missing both structured fields (subject/action/dialog) AND legacy video_prompt!`);
             console.error('videoPrompt object:', JSON.stringify(videoPrompt, null, 2));
             throw new Error(`Scene ${i} prompt is empty/invalid - STOPPING WORKFLOW`);
          }

          const { taskId } = await generateVideoWithKIE(
            videoPrompt as Record<string, unknown>,
            [project.generated_image_url, project.generated_image_url], // Use generated image as start AND end frame for consistency
            project.video_aspect_ratio as '16:9' | '9:16' | undefined,
            project.language, // Pass language for video prompt
            {
              hasProductContext: Boolean(project.product_context?.product_name || project.product_image_urls?.length),
              model: resolvedVideoModel,
              sceneNumber: i,
              totalScenes: videoScenes,
              durationSeconds: getAvatarSceneDurationSeconds(videoPrompt, resolvedVideoModel, {
                plannedDurationSeconds: plannedSceneDurations[i - 1],
                totalScenes: videoScenes,
                language: project.language
              }),
              avatarGender: project.avatar_gender
            }
          );

          videoTaskIds.push(taskId);

          // Update scene status
          await supabase
            .from('avatar_ads_scenes')
            .update({
              kie_video_task_id: taskId,  // Renamed from kie_task_id
              status: 'generating'
            })
            .eq('project_id', project.id)
            .eq('scene_number', i);
        }

        // Update project
        const { data: updatedProject, error } = await supabase
          .from('avatar_ads_projects')
          .update({
            kie_video_task_ids: videoTaskIds,
            status: 'generating_videos',
            current_step: 'generating_videos',
            progress_percentage: 70,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        // No event recording

        return {
          project: updatedProject,
          message: 'Video generation started for all scenes',
          nextStep: 'check_videos_status'
        };
      }

      case 'check_videos_status': {
        // Check all video generation status
        if (!project.kie_video_task_ids || project.kie_video_task_ids.length === 0) {
          throw new Error('Video task IDs not found');
        }
        const promptScenes = getAvatarPromptScenes(project.generated_prompts);

        const videoUrls: string[] = [];
        let allCompleted = true;
        let hasRetries = false;
        const currentTaskIds = [...project.kie_video_task_ids]; // Copy for mutation

        for (let i = 0; i < currentTaskIds.length; i++) {
          const taskId = currentTaskIds[i];
          const status = await checkKIEVideoTaskStatus(taskId, resolveAvatarAdsVideoModel(project));

          if (status.status === 'completed' && status.result_url) {
            // Collect video URL
            videoUrls.push(status.result_url);

            // Update scene status in database
            await supabase
              .from('avatar_ads_scenes')
              .update({
                video_url: status.result_url,
                status: 'completed'
              })
              .eq('project_id', project.id)
              .eq('scene_number', i + 1);

          } else if (status.status === 'failed') {
            // NEW: Server errors are handled by monitor-tasks, not here
            if (status.isRetryable) {
              allCompleted = false;
              continue; // Don't throw - let monitor-tasks handle retry
            }

            // Check if content policy error (unlimited retry by workflow)
            const isContentPolicy = status.error && (
              status.error.includes('content policy') ||
              status.error.includes('Safety check failed') ||
              status.error.includes('violating content policies')
            );

            if (isContentPolicy) {
              // Retrieve prompt for this scene
              const videoPrompt = promptScenes[i]?.prompt as Record<string, unknown> | undefined;

              if (videoPrompt) {
                // Regenerate video task using updated generation logic (handles both structured and legacy)
                const { taskId: newTaskId } = await generateVideoWithKIE(
                  videoPrompt as Record<string, unknown>,
                  [project.generated_image_url!, project.generated_image_url!],
                  project.video_aspect_ratio as '16:9' | '9:16' | undefined,
                  project.language,
                  {
                    model: resolveAvatarAdsVideoModel(project),
                    sceneNumber: i + 1,
                    totalScenes: promptScenes.length,
                    durationSeconds: getAvatarSceneDurationSeconds(videoPrompt, resolveAvatarAdsVideoModel(project), {
                      plannedDurationSeconds: getAvatarPlannedSceneDurations(project.generated_prompts)[i],
                      totalScenes: promptScenes.length,
                      language: project.language
                    })
                  }
                );

                // Update task ID in local array
                currentTaskIds[i] = newTaskId;
                hasRetries = true;
                allCompleted = false;

                // Update scene record immediately
                await supabase
                  .from('avatar_ads_scenes')
                  .update({
                    kie_video_task_id: newTaskId,
                    status: 'generating'
                  })
                  .eq('project_id', project.id)
                  .eq('scene_number', i + 1);
                  
                continue; // Skip error throwing
              }
            }

            throw new Error(`Video ${i + 1} generation failed: ${status.error}`);
          } else {
            allCompleted = false;
          }
        }

        // Save retries if any
        if (hasRetries) {
           await supabase
            .from('avatar_ads_projects')
            .update({
              kie_video_task_ids: currentTaskIds,
              last_processed_at: new Date().toISOString()
            })
            .eq('id', project.id);
            
           return {
             project: { ...project, kie_video_task_ids: currentTaskIds },
             message: 'Retrying failed video tasks due to content policy...',
             nextStep: 'check_videos_status' // Stay in this step
           };
        }

        if (allCompleted) {
          // All videos completed
          if (videoUrls.length === 0) {
            throw new Error('No video URLs collected despite all tasks completed');
          }

          // Check if we need to merge videos (single-scene vs multi-scene)
          const videoScenes = promptScenes.length;
          if (videoScenes === 1) {
            // For 8-second videos, use the single generated video directly
            const { data: updatedProject, error } = await supabase
              .from('avatar_ads_projects')
              .update({
                merged_video_url: videoUrls[0], // Use the single video directly
                status: 'completed',
                current_step: 'completed',
                progress_percentage: 100,
                last_processed_at: new Date().toISOString()
              })
              .eq('id', project.id)
              .select()
              .single();

            if (error) throw error;

            // No event recording

            return {
              project: updatedProject,
              message: 'Video generation completed (no merge needed for 8s)'
            };
          } else {
            // For longer videos, proceed with merging
            const { data: updatedProject, error } = await supabase
              .from('avatar_ads_projects')
              .update({
                status: 'merging_videos',
                current_step: 'merging_videos',
                progress_percentage: 85,
                last_processed_at: new Date().toISOString()
              })
              .eq('id', project.id)
              .select()
              .single();

            if (error) throw error;

            // No event recording

            return {
              project: updatedProject,
              message: 'All videos generated, starting merge',
              nextStep: 'merge_videos'
            };
          }
        }

        // Still processing
        return {
          project,
          message: 'Video generation in progress'
        };
      }

      case 'merge_videos': {
        // Step 5: Merge videos using fal.ai (Event-Driven with Webhook)
        // Query video URLs from scenes table
        const { data: scenes } = await supabase
          .from('avatar_ads_scenes')
          .select('video_url, scene_number')
          .eq('project_id', project.id)
          .eq('status', 'completed')
          .order('scene_number', { ascending: true });

        const videoUrls = scenes?.map(s => s.video_url).filter(Boolean) || [];

        if (videoUrls.length === 0) {
          throw new Error('No video URLs available for merging');
        }

        // ✅ Submit merge task with webhook (non-blocking)
        // Webhook will update project to 'completed' when merge finishes
        const { taskId } = await mergeVideosWithFal(
          videoUrls,
          project.video_aspect_ratio as '16:9' | '9:16'
        );

        // Update project with task ID
        const { data: updatedProject, error } = await supabase
          .from('avatar_ads_projects')
          .update({
            fal_merge_task_id: taskId,
            status: 'merging_videos',
            progress_percentage: 90,
            last_processed_at: new Date().toISOString()
          })
          .eq('id', project.id)
          .select()
          .single();

        if (error) throw error;

        console.log(`🔔 [Avatar Ads] Merge task submitted, webhook will handle completion: ${taskId}`);

        // No event recording

        return {
          project: updatedProject,
          message: 'Video merging started (webhook mode)',
          // ✅ No nextStep - webhook will handle completion
        };
      }

      // ❌ REMOVED: check_merge_status step
      // No longer needed - fal.ai webhook handles completion automatically
      // See: /api/avatar-ads/webhooks/merge

      default: {
        throw new Error(`Unknown step: ${step}`);
      }
    }

  } catch (error) {
    console.error(`Error processing step ${step}:`, error);

    // ===== VERSION 2.0: SCENE-LEVEL REFUND ON FAILURE =====
    // Determine if we need to refund credits (only if video generation was attempted)
    const videoGenerationSteps = ['generate_videos', 'check_videos_status', 'merge_videos', 'check_merge_status'];
    const shouldRefund = videoGenerationSteps.includes(step);

    if (shouldRefund) {
      try {
        // Fetch scenes to count permanently failed ones (retry_count >= 3)
        const { data: scenes } = await supabase
          .from('avatar_ads_scenes')
          .select('scene_number, status, retry_count')
          .eq('project_id', project.id);

        const permanentlyFailedScenes = scenes?.filter(
          s => s.status === 'failed' && (s.retry_count || 0) >= 3
        ) || [];
        const promptScenes = getAvatarPromptScenes(project.generated_prompts);

        if (permanentlyFailedScenes.length > 0) {
          const plannedSceneDurations = getAvatarPlannedSceneDurations(project.generated_prompts);
          const refundAmount = permanentlyFailedScenes.reduce((sum, scene) => (
            sum + getSegmentVideoGenerationCost(
              resolveAvatarAdsVideoModel(project),
              getAvatarSceneDurationSeconds(
                promptScenes[(scene.scene_number || 1) - 1]?.prompt,
                resolveAvatarAdsVideoModel(project),
                {
                  plannedDurationSeconds: plannedSceneDurations[(scene.scene_number || 1) - 1],
                  totalScenes: promptScenes.length,
                  language: project.language
                }
              )
            )
          ), 0);

          const { refundCredits } = await import('@/lib/credits');
          const refundResult = await refundCredits(
            project.user_id,
            refundAmount,
            `Avatar Ads - Refund for ${permanentlyFailedScenes.length} failed video scenes after max retries`,
            project.id
          );

          if (!refundResult.success) {
            console.error(`❌ Failed to refund credits:`, refundResult.error);
            // TODO: This should trigger alerting - user paid but didn't get service
          }
        } else {
          // No permanently failed scenes yet - might be a different error before scenes were created
          // Or scenes are still retrying
          // If error occurred before scenes were created or during generation, refund full cost
          if (!scenes || scenes.length === 0 || step === 'generate_videos') {
            const generationCost = getGenerationCost(
              resolveAvatarAdsVideoModel(project),
              String(
                getAvatarPlannedTotalDurationSeconds(
                  project.generated_prompts,
                  resolveAvatarAdsVideoModel(project),
                  project.video_duration_seconds,
                  project.language
                )
              )
            );

            if (generationCost > 0) {
              const { refundCredits } = await import('@/lib/credits');
              const refundResult = await refundCredits(
                project.user_id,
                generationCost,
                `Avatar Ads - Refund for failed video generation (step: ${step})`,
                project.id
              );

              if (!refundResult.success) {
                console.error(`❌ Failed to refund credits:`, refundResult.error);
              }
            }
          }
        }
      } catch (refundError) {
        console.error('❌ Error during refund process:', refundError);
        // Don't throw - we still want to mark project as failed
      }
    }

    // Update project with error
    await supabase
      .from('avatar_ads_projects')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        last_processed_at: new Date().toISOString()
      })
      .eq('id', project.id);

    // No event recording on error

    throw error;
  }
}
