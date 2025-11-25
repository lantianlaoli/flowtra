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
  contains_brand?: boolean;
  contains_product?: boolean;
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

const toBooleanValue = (value: unknown): boolean => Boolean(value);

const clampDuration = (value: number, fallback = 6): number => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
};

export const parseShotsFromAnalysis = (analysisShots: unknown): CompetitorShotForm[] => {
  if (!Array.isArray(analysisShots)) return [];
  return analysisShots.map((shot, index) => {
    const record = toRecord(shot) || {};
    return {
      shot_id: clampDuration(toNumberValue(record.shot_id, index + 1), index + 1),
      start_time: toStringValue(record.start_time) || '00:00',
      end_time: toStringValue(record.end_time) || '00:00',
      duration_seconds: clampDuration(toNumberValue(record.duration_seconds, 6)),
      first_frame_description: toStringValue(record.first_frame_description),
      subject: toStringValue(record.subject),
      context_environment: toStringValue(record.context_environment),
      action: toStringValue(record.action),
      style: toStringValue(record.style),
      camera_motion_positioning: toStringValue(record.camera_motion_positioning),
      composition: toStringValue(record.composition),
      ambiance_colour_lighting: toStringValue(record.ambiance_colour_lighting),
      audio: toStringValue(record.audio),
      contains_brand: toBooleanValue(record.contains_brand),
      contains_product: toBooleanValue(record.contains_product)
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
    audio: shot.audio?.trim() || '',
    contains_brand: Boolean(shot.contains_brand),
    contains_product: Boolean(shot.contains_product)
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
  audio: '',
  contains_brand: false,
  contains_product: false
});

export const reindexShots = (shots: CompetitorShotForm[]): CompetitorShotForm[] =>
  shots.map((shot, index) => ({
    ...shot,
    shot_id: index + 1
  }));
