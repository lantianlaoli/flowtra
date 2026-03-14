import { analysisToLegacyFlatShots } from '@/lib/video-analysis-schema';
import { parseCompetitorTimeline } from '@/lib/competitor-shots';

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
  focus_lens_effects: string;
  audio_summary: string;
  dialogue: string;
  sfx?: string;
  ambient?: string;
}

const clampDuration = (value: number, fallback = 6): number => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.round(value));
};

const toNumberValue = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
};

export const parseShotsFromAnalysis = (analysisInput: unknown): CompetitorShotForm[] => {
  const normalizedAnalysis = (
    (Array.isArray(analysisInput)
      ? { shots: analysisInput }
      : analysisInput) as Record<string, unknown> | null | undefined
  );

  const timeline = parseCompetitorTimeline(normalizedAnalysis);
  if (timeline.shots.length > 0) {
    return timeline.shots.map((shot, index) => ({
      shot_id: index + 1,
      start_time: shot.startTime,
      end_time: shot.endTime,
      duration_seconds: clampDuration(shot.durationSeconds),
      first_frame_description: shot.firstFrameDescription,
      subject: shot.subject,
      context_environment: shot.contextEnvironment,
      action: shot.action,
      style: shot.style,
      camera_motion_positioning: shot.cameraMotionPositioning,
      composition: shot.composition,
      ambiance_colour_lighting: shot.ambianceColourLighting,
      focus_lens_effects: shot.focusLensEffects || '',
      audio_summary: shot.audio,
      dialogue: shot.dialogue || '',
      sfx: shot.sfx || '',
      ambient: shot.ambient || '',
    }));
  }

  const normalized = analysisToLegacyFlatShots(normalizedAnalysis);

  return normalized.map((shot, index) => ({
    shot_id: index + 1,
    start_time: shot.start_time,
    end_time: shot.end_time,
    duration_seconds: clampDuration(shot.duration_seconds),
    first_frame_description: shot.first_frame_description,
    subject: shot.subject,
    context_environment: shot.context_environment,
    action: shot.action,
    style: shot.style,
    camera_motion_positioning: shot.camera_motion_positioning,
    composition: shot.composition,
    ambiance_colour_lighting: shot.ambiance_colour_lighting,
    focus_lens_effects: shot.focus_lens_effects || '',
    audio_summary: shot.audio_summary,
    dialogue: shot.dialogue,
    sfx: shot.sfx || '',
    ambient: shot.ambient || '',
  }));
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
    focus_lens_effects: shot.focus_lens_effects?.trim() || '',
    audio_summary: shot.audio_summary?.trim() || '',
    dialogue: shot.dialogue?.trim() || '',
    sfx: shot.sfx?.trim() || '',
    ambient: shot.ambient?.trim() || ''
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
  focus_lens_effects: '',
  audio_summary: '',
  dialogue: '',
  sfx: '',
  ambient: ''
});

export const reindexShots = (shots: CompetitorShotForm[]): CompetitorShotForm[] =>
  shots.map((shot, index) => ({
    ...shot,
    shot_id: index + 1
  }));
