export interface CompetitorShot {
  id: number;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  firstFrameDescription: string;
  subject: string;
  contextEnvironment: string;
  action: string;
  style: string;
  cameraMotionPositioning: string;
  composition: string;
  ambianceColourLighting: string;
  audio: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  containsBrand: boolean; // NEW: Whether this shot contains brand elements
  containsProduct: boolean; // NEW: Whether this shot contains product
}

export interface CompetitorTimeline {
  videoDurationSeconds: number | null;
  shots: CompetitorShot[];
}

type JsonRecord = Record<string, unknown>;

const toRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === 'object' ? (value as JsonRecord) : null;

const toString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
};

const toNumber = (value: unknown): number | null => {
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num)) return null;
  return num;
};

const clampDuration = (value: number | null | undefined, fallback = 8): number => {
  if (!Number.isFinite(value ?? NaN) || (value ?? 0) <= 0) {
    return fallback;
  }
  return Math.max(1, Math.round(value as number));
};

export const parseTimecode = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map(part => Number(part));
  if (parts.some(part => Number.isNaN(part) || part < 0)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
};

export const formatTimecode = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export function parseCompetitorTimeline(
  analysisResult: JsonRecord | null | undefined,
  fallbackDuration?: number | null
): CompetitorTimeline {
  const safeAnalysis = toRecord(analysisResult);
  const rawShots = Array.isArray(safeAnalysis?.shots) ? safeAnalysis?.shots : [];
  const shots: CompetitorShot[] = [];

  let rollingStartSeconds = 0;

  rawShots.forEach((rawShot, index) => {
    const shotRecord = toRecord(rawShot);
    if (!shotRecord) return;

    const id = clampDuration(toNumber(shotRecord.shot_id), index + 1);
    const providedStart = parseTimecode(toString(shotRecord.start_time));
    const providedEnd = parseTimecode(toString(shotRecord.end_time));
    const providedDuration = toNumber(shotRecord.duration_seconds);

    const startSeconds = providedStart ?? rollingStartSeconds;
    let durationSeconds = clampDuration(providedDuration, clampDuration(providedEnd !== null && providedStart !== null ? providedEnd - providedStart : null));
    if (providedEnd !== null && providedStart !== null) {
      durationSeconds = clampDuration(providedEnd - providedStart, durationSeconds);
    }

    const endSeconds = startSeconds + durationSeconds;

    // Extract brand/product flags (default to false if not present)
    const containsBrand = Boolean(shotRecord.contains_brand);
    const containsProduct = Boolean(shotRecord.contains_product);

    shots.push({
      id,
      startTime: formatTimecode(startSeconds),
      endTime: formatTimecode(endSeconds),
      durationSeconds,
      firstFrameDescription: toString(shotRecord.first_frame_description),
      subject: toString(shotRecord.subject),
      contextEnvironment: toString(shotRecord.context_environment),
      action: toString(shotRecord.action),
      style: toString(shotRecord.style),
      cameraMotionPositioning: toString(shotRecord.camera_motion_positioning),
      composition: toString(shotRecord.composition),
      ambianceColourLighting: toString(shotRecord.ambiance_colour_lighting),
      audio: toString(shotRecord.audio),
      startTimeSeconds: startSeconds,
      endTimeSeconds: endSeconds,
      containsBrand, // NEW
      containsProduct // NEW
    });

    rollingStartSeconds = endSeconds;
  });

  const detectedDuration = toNumber(safeAnalysis?.video_duration_seconds);
  const fallbackRounded = clampDuration(fallbackDuration ?? null, shots.reduce((sum, shot) => sum + shot.durationSeconds, 0));
  const videoDurationSeconds = clampDuration(detectedDuration ?? fallbackRounded, fallbackRounded);

  return {
    videoDurationSeconds,
    shots
  };
}

export function sumShotDurations(shots: CompetitorShot[]): number {
  return shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
}
