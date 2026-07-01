import { formatTimelineRange } from '@/lib/segment-shot-timeline';
import { SEEDANCE_MIN_TASK_DURATION_SECONDS } from '@/lib/constants';

export const PROJECT_AGENT_DEFAULT_SHOT_TIME_RANGE = formatTimelineRange(0, SEEDANCE_MIN_TASK_DURATION_SECONDS);

export type ProjectAgentCloneShot = {
  id: number;
  time_range: string;
  audio: string;
  sfx: string;
  ambient: string;
  style: string;
  action: string;
  subject: string;
  dialogue: string;
  language?: string;
  composition: string;
  context_environment: string;
  ambiance_colour_lighting: string;
  camera_motion_positioning: string;
};

export function parseProjectAgentLegacyAudioField(value?: string | null) {
  const source = (value || '').trim();
  if (!source) {
    return { sfx: '', ambient: '' };
  }

  const sfxMatch = source.match(/SFX:\s*([^|]+)/i);
  const ambientMatch = source.match(/Ambient:\s*([^|]+)/i);
  if (sfxMatch || ambientMatch) {
    return {
      sfx: (sfxMatch?.[1] || '').trim(),
      ambient: (ambientMatch?.[1] || '').trim(),
    };
  }

  return { sfx: '', ambient: source };
}

export function buildProjectAgentLegacyAudioField(input: {
  sfx?: string | null;
  ambient?: string | null;
}) {
  const parts = [
    input.sfx?.trim() ? `SFX: ${input.sfx.trim()}` : '',
    input.ambient?.trim() ? `Ambient: ${input.ambient.trim()}` : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

export function createProjectAgentCloneShot(
  id: number,
  fallbackLanguage = 'en',
  overrides: Partial<ProjectAgentCloneShot> = {}
): ProjectAgentCloneShot {
  const parsedAudio = parseProjectAgentLegacyAudioField(overrides.audio);
  const sfx = (overrides.sfx || '').trim() || parsedAudio.sfx;
  const ambient = (overrides.ambient || '').trim() || parsedAudio.ambient;

  return {
    id,
    time_range: overrides.time_range || PROJECT_AGENT_DEFAULT_SHOT_TIME_RANGE,
    audio: buildProjectAgentLegacyAudioField({ sfx, ambient }),
    sfx,
    ambient,
    style: overrides.style || '',
    action: overrides.action || '',
    subject: overrides.subject || '',
    dialogue: overrides.dialogue || '',
    language: overrides.language || fallbackLanguage,
    composition: overrides.composition || '',
    context_environment: overrides.context_environment || '',
    ambiance_colour_lighting: overrides.ambiance_colour_lighting || '',
    camera_motion_positioning: overrides.camera_motion_positioning || '',
  };
}

export function normalizeProjectAgentCloneShot(
  shot: Partial<ProjectAgentCloneShot> | undefined,
  index: number,
  fallbackLanguage = 'en'
): ProjectAgentCloneShot {
  return createProjectAgentCloneShot(
    Number.isFinite(Number(shot?.id)) && Number(shot?.id) > 0 ? Number(shot?.id) : index + 1,
    fallbackLanguage,
    shot
  );
}

export function serializeProjectAgentCloneShot(
  shot: Partial<ProjectAgentCloneShot> | undefined,
  index: number,
  fallbackLanguage = 'en'
): ProjectAgentCloneShot {
  const normalized = normalizeProjectAgentCloneShot(shot, index, fallbackLanguage);
  return {
    ...normalized,
    id: index + 1,
    time_range: normalized.time_range.trim() || PROJECT_AGENT_DEFAULT_SHOT_TIME_RANGE,
    audio: buildProjectAgentLegacyAudioField(normalized),
    sfx: normalized.sfx.trim(),
    ambient: normalized.ambient.trim(),
    style: normalized.style.trim(),
    action: normalized.action.trim(),
    subject: normalized.subject.trim(),
    dialogue: normalized.dialogue.trim(),
    language: normalized.language?.trim() || fallbackLanguage,
    composition: normalized.composition.trim(),
    context_environment: normalized.context_environment.trim(),
    ambiance_colour_lighting: normalized.ambiance_colour_lighting.trim(),
    camera_motion_positioning: normalized.camera_motion_positioning.trim(),
  };
}
