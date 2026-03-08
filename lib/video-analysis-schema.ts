export interface CanonicalAnalysisV2 {
  schema_version: 2;
  name: string;
  detected_language: string;
  video_duration_seconds: number;
  shots: CanonicalShotV2[];
}

export interface CanonicalShotV2 {
  shot_id: number;
  timing: {
    start_time: string;
    end_time: string;
    duration_seconds: number;
  };
  opening_frame: {
    description: string;
  };
  visual: {
    subject: string;
    action: string;
    environment: string;
    style: string;
    camera: string;
    composition: string;
    focus_lens_effects: string;
    ambiance: string;
  };
  audio: {
    dialogue: string;
    sfx: string;
    ambient: string;
  };
  flags: {
    contains_brand?: boolean;
    contains_product?: boolean;
  };
}

export interface LegacyFlatShot {
  shot_id: number;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  first_frame_description: string;
  subject: string;
  context_environment: string;
  action: string;
  style: string;
  camera_motion_positioning: string;
  composition: string;
  ambiance_colour_lighting: string;
  focus_lens_effects: string;
  audio_summary: string;
  dialogue: string;
  contains_brand?: boolean;
  contains_product?: boolean;
  sfx?: string;
  ambient?: string;
}

type JsonRecord = Record<string, unknown>;

const toRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === 'object' ? (value as JsonRecord) : null;

const toStringValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const toNumberValue = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
};

const clampDuration = (value: number, fallback = 6): number => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
};

const formatSecondsToTime = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60).toString().padStart(2, '0');
  const ss = (safe % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
};

const normalizeTimeValue = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatSecondsToTime(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '00:00';
    const maybeNum = Number(trimmed);
    if (Number.isFinite(maybeNum)) {
      return formatSecondsToTime(maybeNum);
    }
    return trimmed;
  }

  return '00:00';
};

const compactParts = (parts: Array<string | null | undefined>) =>
  parts.map(part => (part || '').trim()).filter(Boolean);

const joinAudioParts = (parts: Array<string | null | undefined>) => compactParts(parts).join(' | ');

export const isCanonicalAnalysisV2 = (value: unknown): value is CanonicalAnalysisV2 => {
  const record = toRecord(value);
  if (!record) return false;
  return record.schema_version === 2
    && Array.isArray(record.shots);
};

const legacyShotToV2 = (shot: unknown, index: number): CanonicalShotV2 => {
  const record = toRecord(shot) || {};
  const fallbackDescription = toStringValue(
    record.description ?? record.visual_description ?? record.summary
  );
  const explicitDialogue = toStringValue(
    record.dialogue ?? record.transcript ?? record.voiceover ?? record.spoken_words
  );
  const legacyAudio = toStringValue(record.audio);
  const audioBed = toStringValue(record.audio_summary) || legacyAudio;

  const normalizedStartTime = normalizeTimeValue(record.start_time);
  const normalizedEndTime = normalizeTimeValue(record.end_time);
  const startSeconds = toNumberValue(record.start_time, NaN);
  const endSeconds = toNumberValue(record.end_time, NaN);
  const derivedDuration = Number.isFinite(startSeconds) && Number.isFinite(endSeconds)
    ? Math.max(1, Math.round(endSeconds - startSeconds))
    : 0;
  const durationRaw = toNumberValue(record.duration_seconds, derivedDuration || 6);

  return {
    shot_id: clampDuration(toNumberValue(record.shot_id ?? record.id, index + 1), index + 1),
    timing: {
      start_time: normalizedStartTime,
      end_time: normalizedEndTime,
      duration_seconds: clampDuration(durationRaw),
    },
    opening_frame: {
      description: toStringValue(record.first_frame_description) || fallbackDescription,
    },
    visual: {
      subject: toStringValue(record.subject ?? record.main_subject ?? record.hero_subject),
      action: toStringValue(record.action) || fallbackDescription,
      environment: toStringValue(record.context_environment ?? record.environment),
      style: toStringValue(record.style ?? record.visual_style),
      camera: toStringValue(record.camera_motion_positioning ?? record.camera_motion ?? record.camera),
      composition: toStringValue(record.composition ?? record.framing),
      focus_lens_effects: toStringValue(record.focus_lens_effects ?? record.focus ?? record.lens_effects),
      ambiance: toStringValue(record.ambiance_colour_lighting ?? record.ambiance_color_lighting ?? record.lighting),
    },
    audio: {
      dialogue: explicitDialogue,
      sfx: toStringValue(record.sfx),
      ambient: toStringValue(record.ambient) || audioBed,
    },
    flags: {
      contains_brand: typeof record.contains_brand === 'boolean' ? record.contains_brand : undefined,
      contains_product: typeof record.contains_product === 'boolean' ? record.contains_product : undefined,
    },
  };
};

export const normalizeAnalysisToV2 = (
  analysis: Record<string, unknown> | null | undefined
): CanonicalAnalysisV2 | null => {
  const record = toRecord(analysis);
  if (!record) return null;

  if (isCanonicalAnalysisV2(record)) {
    return {
      schema_version: 2,
      name: toStringValue(record.name),
      detected_language: toStringValue(record.detected_language) || 'en',
      video_duration_seconds: clampDuration(toNumberValue(record.video_duration_seconds, 0), 1),
      shots: (record.shots as unknown[]).map((shot, index) => {
        const shotRecord = toRecord(shot) || {};
        const timing = toRecord(shotRecord.timing) || {};
        const openingFrame = toRecord(shotRecord.opening_frame) || {};
        const visual = toRecord(shotRecord.visual) || {};
        const audio = toRecord(shotRecord.audio) || {};
        const flags = toRecord(shotRecord.flags) || {};

        return {
          shot_id: clampDuration(toNumberValue(shotRecord.shot_id, index + 1), index + 1),
          timing: {
            start_time: normalizeTimeValue(timing.start_time),
            end_time: normalizeTimeValue(timing.end_time),
            duration_seconds: clampDuration(
              toNumberValue(timing.duration_seconds, 6),
              6
            ),
          },
          opening_frame: {
            description: toStringValue(openingFrame.description),
          },
          visual: {
            subject: toStringValue(visual.subject),
            action: toStringValue(visual.action),
            environment: toStringValue(visual.environment),
            style: toStringValue(visual.style),
            camera: toStringValue(visual.camera),
            composition: toStringValue(visual.composition),
            focus_lens_effects: toStringValue(visual.focus_lens_effects),
            ambiance: toStringValue(visual.ambiance),
          },
          audio: {
            dialogue: toStringValue(audio.dialogue),
            sfx: toStringValue(audio.sfx),
            ambient: toStringValue(audio.ambient),
          },
          flags: {
            contains_brand: typeof flags.contains_brand === 'boolean' ? flags.contains_brand : undefined,
            contains_product: typeof flags.contains_product === 'boolean' ? flags.contains_product : undefined,
          },
        } satisfies CanonicalShotV2;
      }),
    };
  }

  const rawShots = Array.isArray(record.shots) ? record.shots : [];
  return {
    schema_version: 2,
    name: toStringValue(record.name),
    detected_language: toStringValue(record.detected_language) || 'en',
    video_duration_seconds: clampDuration(toNumberValue(record.video_duration_seconds, 0), 1),
    shots: rawShots.map((shot, index) => legacyShotToV2(shot, index)),
  };
};

export const canonicalShotToLegacyFlat = (shot: CanonicalShotV2): LegacyFlatShot => {
  const audioSummary = joinAudioParts([
    shot.audio.sfx,
    shot.audio.ambient,
  ]);

  return {
    shot_id: shot.shot_id,
    start_time: normalizeTimeValue(shot.timing.start_time),
    end_time: normalizeTimeValue(shot.timing.end_time),
    duration_seconds: clampDuration(toNumberValue(shot.timing.duration_seconds, 6)),
    first_frame_description: toStringValue(shot.opening_frame.description),
    subject: toStringValue(shot.visual.subject),
    context_environment: toStringValue(shot.visual.environment),
    action: toStringValue(shot.visual.action),
    style: toStringValue(shot.visual.style),
    camera_motion_positioning: toStringValue(shot.visual.camera),
    composition: toStringValue(shot.visual.composition),
    ambiance_colour_lighting: toStringValue(shot.visual.ambiance),
    focus_lens_effects: toStringValue(shot.visual.focus_lens_effects),
    audio_summary: audioSummary,
    dialogue: toStringValue(shot.audio.dialogue),
    contains_brand: shot.flags.contains_brand,
    contains_product: shot.flags.contains_product,
    sfx: toStringValue(shot.audio.sfx),
    ambient: toStringValue(shot.audio.ambient),
  };
};

export const analysisToLegacyFlatShots = (
  analysis: Record<string, unknown> | CanonicalAnalysisV2 | null | undefined
): LegacyFlatShot[] => {
  const normalized = normalizeAnalysisToV2(analysis as Record<string, unknown> | null | undefined);
  if (!normalized) return [];
  return normalized.shots.map(canonicalShotToLegacyFlat);
};

export const getAnalysisShotCount = (
  analysis: Record<string, unknown> | CanonicalAnalysisV2 | null | undefined
): number => analysisToLegacyFlatShots(analysis).length;

export const toPersistedAnalysisV2 = (
  analysis: Record<string, unknown> | CanonicalAnalysisV2 | null | undefined
): CanonicalAnalysisV2 | null => normalizeAnalysisToV2(analysis as Record<string, unknown> | null | undefined);

export const buildAudioSummary = (audio: CanonicalShotV2['audio']): string =>
  joinAudioParts([audio.sfx, audio.ambient]);
