import { analysisToLegacyFlatShots, getAnalysisShotCount } from '@/lib/video-analysis-schema';

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
  focusLensEffects?: string;
  audio: string;
  dialogue?: string;
  sfx?: string;
  ambient?: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
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
  const rawShots = analysisToLegacyFlatShots(safeAnalysis);
  const shots: CompetitorShot[] = [];

  let rollingStartSeconds = 0;

  rawShots.forEach((rawShot, index) => {
    const id = clampDuration(toNumber(rawShot.shot_id), index + 1);
    const providedStart = parseTimecode(toString(rawShot.start_time));
    const providedEnd = parseTimecode(toString(rawShot.end_time));
    const providedDuration = toNumber(rawShot.duration_seconds);

    const startSeconds = providedStart ?? rollingStartSeconds;
    let durationSeconds = clampDuration(providedDuration, clampDuration(providedEnd !== null && providedStart !== null ? providedEnd - providedStart : null));
    if (providedEnd !== null && providedStart !== null) {
      durationSeconds = clampDuration(providedEnd - providedStart, durationSeconds);
    }

    const endSeconds = startSeconds + durationSeconds;

    shots.push({
      id,
      startTime: formatTimecode(startSeconds),
      endTime: formatTimecode(endSeconds),
      durationSeconds,
      firstFrameDescription: toString(rawShot.first_frame_description),
      subject: toString(rawShot.subject),
      contextEnvironment: toString(rawShot.context_environment),
      action: toString(rawShot.action),
      style: toString(rawShot.style),
      cameraMotionPositioning: toString(rawShot.camera_motion_positioning),
      composition: toString(rawShot.composition),
      ambianceColourLighting: toString(rawShot.ambiance_colour_lighting),
      focusLensEffects: toString(rawShot.focus_lens_effects),
      audio: toString(rawShot.audio_summary),
      dialogue: toString(rawShot.dialogue),
      sfx: toString(rawShot.sfx),
      ambient: toString(rawShot.ambient),
      startTimeSeconds: startSeconds,
      endTimeSeconds: endSeconds
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

export function getCompetitorShotCount(
  analysisResult: JsonRecord | null | undefined
): number {
  return getAnalysisShotCount(analysisResult);
}

export function sumShotDurations(shots: CompetitorShot[]): number {
  return shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
}
