import { KLING_MIN_TASK_DURATION_SECONDS } from '@/lib/constants';
import type { SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';
import { parseTimelineRange } from '@/lib/segment-shot-timeline';
import {
  createProjectAgentCloneShot,
  serializeProjectAgentCloneShot,
  type ProjectAgentCloneShot,
} from '@/lib/project-agent/clone-prompt-schema';

export type ProjectAgentCloneDraftSceneLike = {
  sceneIndex?: number;
  imagePrompt?: string;
  isContinuation?: boolean;
  sourceSummary?: string | null;
  videoPrompt?: string | {
    shots?: Array<Partial<ProjectAgentCloneShot>>;
  };
};

export function cloneDraftSceneToSegmentPrompt(
  scene: ProjectAgentCloneDraftSceneLike,
  fallbackLanguage: string
): SegmentPrompt {
  const fallbackShot = createProjectAgentCloneShot(1, fallbackLanguage);
  const rawShots = typeof scene.videoPrompt === 'string'
    ? [{ subject: scene.videoPrompt }]
    : Array.isArray(scene.videoPrompt?.shots)
      ? scene.videoPrompt.shots
      : [];
  const shots = (rawShots.length > 0 ? rawShots : [fallbackShot]).map((shot, index) => {
    const normalizedShot = serializeProjectAgentCloneShot(shot, index, fallbackLanguage);
    return {
      ...normalizedShot,
      language: normalizedShot.language || fallbackLanguage
    };
  });
  const primaryShot = shots[0] || fallbackShot;

  return {
    index: Math.max(0, (scene.sceneIndex ?? 1) - 1),
    description: (scene.sourceSummary || scene.imagePrompt || '').trim() || undefined,
    first_frame_description: scene.imagePrompt || '',
    is_continuation_from_prev: (scene.sceneIndex ?? 1) > 1
      ? (typeof scene.isContinuation === 'boolean' ? scene.isContinuation : true)
      : false,
    shots,
    audio: primaryShot.audio,
    style: primaryShot.style,
    action: primaryShot.action,
    subject: primaryShot.subject,
    composition: primaryShot.composition,
    context_environment: primaryShot.context_environment,
    ambiance_colour_lighting: primaryShot.ambiance_colour_lighting,
    camera_motion_positioning: primaryShot.camera_motion_positioning,
    dialogue: primaryShot.dialogue,
    language: primaryShot.language || fallbackLanguage,
  };
}

export function getProjectAgentSegmentPromptDurationSeconds(
  segment: Pick<SegmentPrompt, 'shots'>
): number {
  const endTimes = Array.isArray(segment.shots)
    ? segment.shots
        .map((shot) => parseTimelineRange(shot.time_range)?.endSec ?? null)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    : [];

  if (endTimes.length === 0) {
    return KLING_MIN_TASK_DURATION_SECONDS;
  }

  return Math.max(KLING_MIN_TASK_DURATION_SECONDS, Math.round(Math.max(...endTimes)));
}
