export interface CompetitorShotForm {
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
  audio: string;
}

type JsonRecord = Record<string, unknown>;

const toRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === 'object' ? (value as JsonRecord) : null;

const toStringValue = (value: unknown): string =>
  typeof value === 'string' ? value : value == null ? '' : String(value);

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
    // If model returned numeric-like string ("3", "19.5"), convert to MM:SS
    const maybeNum = Number(trimmed);
    if (Number.isFinite(maybeNum)) {
      return formatSecondsToTime(maybeNum);
    }
    return trimmed;
  }

  return '00:00';
};

export const parseShotsFromAnalysis = (analysisShots: unknown): CompetitorShotForm[] => {
  if (!Array.isArray(analysisShots)) return [];
  return analysisShots.map((shot, index) => {
    const record = toRecord(shot) || {};
    const fallbackDescription = toStringValue(
      record.description ?? record.visual_description ?? record.summary
    );

    const normalizedStartTime = normalizeTimeValue(record.start_time);
    const normalizedEndTime = normalizeTimeValue(record.end_time);
    const startSeconds = toNumberValue(record.start_time, NaN);
    const endSeconds = toNumberValue(record.end_time, NaN);
    const derivedDuration = Number.isFinite(startSeconds) && Number.isFinite(endSeconds)
      ? Math.max(1, Math.round(endSeconds - startSeconds))
      : 0;
    const durationRaw = toNumberValue(record.duration_seconds, derivedDuration || 6);

    return {
      shot_id: clampDuration(toNumberValue(record.shot_id, index + 1), index + 1),
      start_time: normalizedStartTime,
      end_time: normalizedEndTime,
      duration_seconds: clampDuration(durationRaw),
      first_frame_description: toStringValue(record.first_frame_description) || fallbackDescription,
      subject: toStringValue(record.subject ?? record.main_subject ?? record.hero_subject),
      context_environment: toStringValue(record.context_environment ?? record.environment),
      action: toStringValue(record.action) || fallbackDescription,
      style: toStringValue(record.style ?? record.visual_style),
      camera_motion_positioning: toStringValue(record.camera_motion_positioning ?? record.camera_motion ?? record.camera),
      composition: toStringValue(record.composition ?? record.framing),
      ambiance_colour_lighting: toStringValue(record.ambiance_colour_lighting ?? record.lighting),
      audio: toStringValue(record.audio ?? record.dialogue ?? record.voiceover)
    };
  });
};

export const sanitizeShotsForSave = (shots: CompetitorShotForm[]): CompetitorShotForm[] => {
  return shots.map((shot, index) => ({
    ...shot,
    shot_id: index + 1,
    start_time: shot.start_time?.trim() || '00:00',
    end_time: shot.end_time?.trim() || '00:00',
    duration_seconds: clampDuration(toNumberValue(shot.duration_seconds, 6)),
    first_frame_description: shot.first_frame_description?.trim() || '',
    subject: shot.subject?.trim() || '',
    context_environment: shot.context_environment?.trim() || '',
    action: shot.action?.trim() || '',
    style: shot.style?.trim() || '',
    camera_motion_positioning: shot.camera_motion_positioning?.trim() || '',
    composition: shot.composition?.trim() || '',
    ambiance_colour_lighting: shot.ambiance_colour_lighting?.trim() || '',
    audio: shot.audio?.trim() || ''
  }));
};

export const createEmptyShot = (id: number): CompetitorShotForm => ({
  shot_id: id,
  start_time: '00:00',
  end_time: '00:00',
  duration_seconds: 6,
  first_frame_description: '',
  subject: '',
  context_environment: '',
  action: '',
  style: '',
  camera_motion_positioning: '',
  composition: '',
  ambiance_colour_lighting: '',
  audio: ''
});

export const reindexShots = (shots: CompetitorShotForm[]): CompetitorShotForm[] =>
  shots.map((shot, index) => ({
    ...shot,
    shot_id: index + 1
  }));
