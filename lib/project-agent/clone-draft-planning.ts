import {
  getSegmentCountFromDuration,
  KLING_MAX_PROJECT_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS,
  snapDurationToModel,
  type VideoDuration,
} from '@/lib/constants';
import { parseCompetitorTimeline, formatTimecode, sumShotDurations, type CompetitorShot } from '@/lib/competitor-shots';
import {
  buildManualCloneSeedPrompts,
  type SegmentPrompt,
} from '@/lib/competitor-ugc-replication-workflow';
import {
  buildProjectAgentLegacyAudioField,
  normalizeProjectAgentCloneShot,
  type ProjectAgentCloneShot,
} from '@/lib/project-agent/clone-prompt-schema';

export type ProjectAgentDraftSeedScene = {
  sceneIndex: number;
  imagePrompt: string;
  isContinuation: boolean;
  sourceSummary?: string | null;
  videoPrompt: {
    shots: ProjectAgentCloneShot[];
  };
};

type BuildProjectAgentCloneDraftSeedsInput = {
  analysisResult?: Record<string, unknown> | null;
  fallbackSummary?: string | null;
  fallbackShots?: string[] | null;
  referenceDurationSeconds?: number | null;
  fallbackDurationSeconds?: number | null;
  language?: string | null;
};

function buildFallbackCompetitorShots(fallbackShots?: string[] | null, fallbackSummary?: string | null): CompetitorShot[] {
  const normalizedShots = (fallbackShots || [])
    .map((shot) => shot?.trim())
    .filter((shot): shot is string => Boolean(shot));

  if (normalizedShots.length > 0) {
    return normalizedShots.slice(0, 8).map((summary, index) => {
      const startSeconds = index * KLING_MIN_TASK_DURATION_SECONDS;
      const endSeconds = startSeconds + KLING_MIN_TASK_DURATION_SECONDS;
      return {
        id: index + 1,
        startTime: formatTimecode(startSeconds),
        endTime: formatTimecode(endSeconds),
        durationSeconds: KLING_MIN_TASK_DURATION_SECONDS,
        firstFrameDescription: summary,
        subject: summary,
        contextEnvironment: '',
        action: summary,
        style: '',
        cameraMotionPositioning: '',
        composition: '',
        ambianceColourLighting: '',
        audio: '',
        dialogue: '',
        sfx: '',
        ambient: '',
        startTimeSeconds: startSeconds,
        endTimeSeconds: endSeconds,
      };
    });
  }

  const summary = fallbackSummary?.trim() || 'Keep the original reference structure and pacing.';
  return [{
    id: 1,
    startTime: formatTimecode(0),
    endTime: formatTimecode(KLING_MIN_TASK_DURATION_SECONDS),
    durationSeconds: KLING_MIN_TASK_DURATION_SECONDS,
    firstFrameDescription: summary,
    subject: summary,
    contextEnvironment: '',
    action: summary,
    style: '',
    cameraMotionPositioning: '',
    composition: '',
    ambianceColourLighting: '',
    audio: '',
    dialogue: '',
    sfx: '',
    ambient: '',
    startTimeSeconds: 0,
    endTimeSeconds: KLING_MIN_TASK_DURATION_SECONDS,
  }];
}

function resolveKlingDuration(
  referenceDurationSeconds?: number | null,
  fallbackDurationSeconds?: number | null,
  timelineTotalDurationSeconds?: number | null,
  shots?: CompetitorShot[]
): VideoDuration {
  const explicitReferenceDuration = Number(referenceDurationSeconds);
  if (Number.isFinite(explicitReferenceDuration) && explicitReferenceDuration > KLING_MAX_PROJECT_DURATION_SECONDS) {
    throw new Error('Kling 3.0 clone supports reference videos up to 60 seconds.');
  }

  const preferredDuration = Number.isFinite(explicitReferenceDuration) && explicitReferenceDuration > 0
    ? explicitReferenceDuration
    : Number.isFinite(Number(timelineTotalDurationSeconds)) && Number(timelineTotalDurationSeconds) > 0
      ? Number(timelineTotalDurationSeconds)
      : Number.isFinite(Number(fallbackDurationSeconds)) && Number(fallbackDurationSeconds) > 0
        ? Number(fallbackDurationSeconds)
        : Math.max(
            KLING_MIN_TASK_DURATION_SECONDS,
            Math.min(
              KLING_MAX_PROJECT_DURATION_SECONDS,
              sumShotDurations(shots || [])
            )
          );

  return snapDurationToModel('kling_3', preferredDuration);
}

function segmentPromptToDraftSeedScene(prompt: SegmentPrompt, index: number, fallbackLanguage: string): ProjectAgentDraftSeedScene {
  const shots = Array.isArray(prompt.shots) && prompt.shots.length > 0
    ? prompt.shots.map((shot, shotIndex) => normalizeProjectAgentCloneShot({
        id: typeof shot.id === 'number' ? shot.id : shotIndex + 1,
        time_range: shot.time_range,
        audio: shot.audio || '',
        sfx: shot.sfx || '',
        ambient: shot.ambient || '',
        style: shot.style || '',
        action: shot.action || '',
        subject: shot.subject || '',
        dialogue: shot.dialogue || '',
        language: shot.language || fallbackLanguage,
        composition: shot.composition || '',
        context_environment: shot.context_environment || '',
        ambiance_colour_lighting: shot.ambiance_colour_lighting || '',
        camera_motion_positioning: shot.camera_motion_positioning || '',
      }, shotIndex, fallbackLanguage))
    : [normalizeProjectAgentCloneShot(undefined, 0, fallbackLanguage)];

  const sourceSummary = (
    prompt.first_frame_description?.trim() ||
    shots[0]?.action?.trim() ||
    shots[0]?.subject?.trim() ||
    null
  );

  return {
    sceneIndex: index + 1,
    imagePrompt: prompt.first_frame_description || sourceSummary || '',
    isContinuation: Boolean(prompt.is_continuation_from_prev),
    sourceSummary,
    videoPrompt: {
      shots: shots.map((shot, shotIndex) => ({
        ...shot,
        id: shotIndex + 1,
        audio: buildProjectAgentLegacyAudioField(shot),
      })),
    },
  };
}

export function buildProjectAgentCloneDraftSeeds(
  input: BuildProjectAgentCloneDraftSeedsInput
) {
  const fallbackLanguage = input.language?.trim() || 'en';
  const parsedTimeline = parseCompetitorTimeline(
    input.analysisResult || null,
    input.referenceDurationSeconds ?? input.fallbackDurationSeconds ?? null
  );
  const competitorShots = parsedTimeline.shots.length > 0
    ? parsedTimeline.shots
    : buildFallbackCompetitorShots(input.fallbackShots, input.fallbackSummary);
  const resolvedDuration = resolveKlingDuration(
    input.referenceDurationSeconds,
    input.fallbackDurationSeconds,
    parsedTimeline.videoDurationSeconds,
    competitorShots
  );

  const segmentPrompts = buildManualCloneSeedPrompts({
    videoModel: 'kling_3',
    segmentCount: getSegmentCountFromDuration(resolvedDuration, 'kling_3'),
    videoDuration: resolvedDuration,
    language: fallbackLanguage,
    competitorShots,
    competitorTotalDurationSeconds: parsedTimeline.videoDurationSeconds ?? undefined,
  });

  return {
    duration: resolvedDuration,
    scenes: segmentPrompts.map((prompt, index) => segmentPromptToDraftSeedScene(prompt, index, fallbackLanguage)),
  };
}
