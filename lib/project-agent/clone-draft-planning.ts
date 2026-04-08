import {
  KLING_MAX_PROJECT_DURATION_SECONDS,
  KLING_MAX_TASK_DURATION_SECONDS,
  KLING_MIN_TASK_DURATION_SECONDS,
  snapDurationToModel,
  type VideoDuration,
} from '@/lib/constants';
import { formatTimecode, parseReferenceVideoTimeline, sumShotDurations, type ReferenceVideoShot } from '@/lib/reference-video-shots';
import { KLING_MAX_MULTI_SHOT_ITEMS } from '@/lib/kling-shot-limits';
import { buildProjectAgentLegacyAudioField, type ProjectAgentCloneShot } from '@/lib/project-agent/clone-prompt-schema';
import { normalizeProjectAgentKlingShots } from '@/lib/project-agent/kling-shot-normalization';

export type ProjectAgentDraftSeedScene = {
  sceneIndex: number;
  imagePrompt: string;
  isContinuation: boolean;
  sourceSummary?: string | null;
  sourceShotIds?: number[];
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

type PlannedShotPart = {
  shot: ReferenceVideoShot;
  durationSeconds: number;
};

type PlannedSceneBucket = {
  sceneIndex: number;
  isContinuation: boolean;
  durationSeconds: number;
  shotParts: PlannedShotPart[];
  sourceShotIds: number[];
};

function buildFallbackReferenceVideoShots(fallbackShots?: string[] | null, fallbackSummary?: string | null): ReferenceVideoShot[] {
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
  shots?: ReferenceVideoShot[]
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

function normalizeShotDurations(shots: ReferenceVideoShot[], targetTotalSeconds: number): PlannedShotPart[] {
  if (!shots.length) return [];

  const sourceDurations = shots.map((shot) => Math.max(1, Math.round(shot.durationSeconds || 1)));
  const sourceTotal = sourceDurations.reduce((sum, value) => sum + value, 0);
  if (sourceTotal <= 0) {
    return shots.map((shot) => ({ shot, durationSeconds: 1 }));
  }

  const safeTargetTotal = Math.max(shots.length, Math.round(targetTotalSeconds));
  const scaled = sourceDurations.map((value) => Math.max(1, Math.floor((value / sourceTotal) * safeTargetTotal)));
  let allocated = scaled.reduce((sum, value) => sum + value, 0);
  let cursor = 0;

  while (allocated < safeTargetTotal) {
    scaled[cursor % scaled.length] += 1;
    allocated += 1;
    cursor += 1;
  }

  while (allocated > safeTargetTotal) {
    const index = scaled.findIndex((value) => value > 1);
    if (index === -1) break;
    scaled[index] -= 1;
    allocated -= 1;
  }

  return shots.map((shot, index) => ({
    shot,
    durationSeconds: scaled[index] || 1,
  }));
}

function hasHardContinuityBreak(previous: ReferenceVideoShot | null, next: ReferenceVideoShot) {
  if (!previous) return false;
  const gapSeconds = Math.round(next.startTimeSeconds - previous.endTimeSeconds);
  return gapSeconds > 1 || gapSeconds < 0;
}

function canRemainingShotsFitIntoScenes(remainingParts: PlannedShotPart[]) {
  if (remainingParts.length === 0) return true;

  const remainingShotCount = remainingParts.length;
  const remainingDuration = remainingParts.reduce((sum, part) => sum + part.durationSeconds, 0);
  const minimumSceneCountFromShots = Math.ceil(remainingShotCount / KLING_MAX_MULTI_SHOT_ITEMS);
  const minimumSceneCountFromDuration = Math.ceil(remainingDuration / KLING_MAX_TASK_DURATION_SECONDS);
  const minimumRequiredScenes = Math.max(minimumSceneCountFromShots, minimumSceneCountFromDuration, 1);

  return remainingDuration >= minimumRequiredScenes * KLING_MIN_TASK_DURATION_SECONDS;
}

function chooseSceneBoundaries(parts: PlannedShotPart[], respectHardBreaks: boolean): Array<{ start: number; end: number }> | null {
  const prefixDurations = [0];
  parts.forEach((part) => {
    prefixDurations.push(prefixDurations[prefixDurations.length - 1] + part.durationSeconds);
  });
  const hardBreakBefore = parts.map((part, index) => (
    index > 0 ? hasHardContinuityBreak(parts[index - 1]?.shot || null, part.shot) : false
  ));

  const memo = new Map<number, Array<{ start: number; end: number }> | null>();
  const choose = (startIndex: number): Array<{ start: number; end: number }> | null => {
    if (startIndex >= parts.length) {
      return [];
    }
    if (memo.has(startIndex)) {
      return memo.get(startIndex) ?? null;
    }

    let best: Array<{ start: number; end: number }> | null = null;

    for (let endIndex = Math.min(parts.length - 1, startIndex + KLING_MAX_MULTI_SHOT_ITEMS - 1); endIndex >= startIndex; endIndex -= 1) {
      if (respectHardBreaks) {
        let crossedHardBreak = false;
        for (let probe = startIndex + 1; probe <= endIndex; probe += 1) {
          if (hardBreakBefore[probe]) {
            crossedHardBreak = true;
            break;
          }
        }
        if (crossedHardBreak) {
          continue;
        }
      }

      const bucketDuration = prefixDurations[endIndex + 1] - prefixDurations[startIndex];
      if (bucketDuration > KLING_MAX_TASK_DURATION_SECONDS) {
        continue;
      }
      if (bucketDuration < KLING_MIN_TASK_DURATION_SECONDS) {
        continue;
      }

      const remaining = parts.slice(endIndex + 1);
      if (!canRemainingShotsFitIntoScenes(remaining)) {
        continue;
      }

      const tail = choose(endIndex + 1);
      if (tail === null) {
        continue;
      }

      const candidate = [{ start: startIndex, end: endIndex }, ...tail];
      if (
        !best ||
        candidate.length < best.length ||
        (candidate.length === best.length && (endIndex - startIndex) > (best[0].end - best[0].start))
      ) {
        best = candidate;
      }
    }

    memo.set(startIndex, best);
    return best;
  };

  return choose(0);
}

function partitionSceneBuckets(parts: PlannedShotPart[]): PlannedSceneBucket[] {
  if (parts.length === 0) {
    return [{
      sceneIndex: 1,
      isContinuation: false,
      durationSeconds: KLING_MIN_TASK_DURATION_SECONDS,
      shotParts: [],
      sourceShotIds: [],
    }];
  }

  // Prefer keeping the analyzed continuity boundaries when they still fit within
  // Kling's per-scene limits. If that is too strict, fall back to a duration/count
  // based partition so dense references can still be cloned without dropping shots.
  const boundaries = (
    chooseSceneBoundaries(parts, true) ||
    chooseSceneBoundaries(parts, false)
  );
  if (!boundaries) {
    throw new Error('Unable to fit the reference shots into Kling 3.0 scene limits without dropping source shots.');
  }

  return boundaries.map((boundary, index) => {
    const shotParts = parts.slice(boundary.start, boundary.end + 1);
    return {
      sceneIndex: index + 1,
      isContinuation: index > 0,
      durationSeconds: shotParts.reduce((sum, part) => sum + part.durationSeconds, 0),
      shotParts,
      sourceShotIds: shotParts.map((part) => part.shot.id),
    };
  });
}

function buildSceneImagePrompt(bucket: PlannedSceneBucket) {
  return (
    bucket.shotParts.find((part) => part.shot.firstFrameDescription?.trim())?.shot.firstFrameDescription?.trim() ||
    bucket.shotParts.find((part) => part.shot.action?.trim())?.shot.action?.trim() ||
    bucket.shotParts.find((part) => part.shot.subject?.trim())?.shot.subject?.trim() ||
    'Reference scene prompt'
  );
}

function buildSceneSourceSummary(bucket: PlannedSceneBucket) {
  const subjects = bucket.shotParts
    .map((part) => part.shot.subject?.trim())
    .filter((value): value is string => Boolean(value));
  const actions = bucket.shotParts
    .map((part) => part.shot.action?.trim())
    .filter((value): value is string => Boolean(value));

  if (subjects.length > 0 && actions.length > 0) {
    return `${subjects[0]} -> ${actions[actions.length - 1]}`;
  }
  return subjects[0] || actions[0] || buildSceneImagePrompt(bucket);
}

function bucketToDraftSeedScene(bucket: PlannedSceneBucket, fallbackLanguage: string): ProjectAgentDraftSeedScene {
  let cursor = 0;
  const rawShots = bucket.shotParts.map((part, index) => {
    const startSec = cursor;
    const endSec = cursor + Math.max(1, Math.round(part.durationSeconds));
    cursor = endSec;

    return {
      id: index + 1,
      time_range: `${formatTimecode(startSec)} - ${formatTimecode(endSec)}`,
      audio: buildProjectAgentLegacyAudioField(part.shot),
      sfx: part.shot.sfx || '',
      ambient: part.shot.ambient || '',
      style: part.shot.style || '',
      action: part.shot.action || '',
      subject: part.shot.subject || '',
      dialogue: part.shot.dialogue || '',
      language: fallbackLanguage,
      composition: part.shot.composition || '',
      context_environment: part.shot.contextEnvironment || '',
      ambiance_colour_lighting: part.shot.ambianceColourLighting || '',
      camera_motion_positioning: part.shot.cameraMotionPositioning || '',
    } satisfies Partial<ProjectAgentCloneShot>;
  });

  const shots = normalizeProjectAgentKlingShots(rawShots, fallbackLanguage).map((shot, index) => ({
    ...shot,
    id: index + 1,
    audio: buildProjectAgentLegacyAudioField(shot),
  }));

  return {
    sceneIndex: bucket.sceneIndex,
    imagePrompt: buildSceneImagePrompt(bucket),
    isContinuation: bucket.isContinuation,
    sourceSummary: buildSceneSourceSummary(bucket),
    sourceShotIds: bucket.sourceShotIds,
    videoPrompt: { shots },
  };
}

export function buildProjectAgentCloneDraftSeeds(
  input: BuildProjectAgentCloneDraftSeedsInput
) {
  const fallbackLanguage = input.language?.trim() || 'en';
  const parsedTimeline = parseReferenceVideoTimeline(
    input.analysisResult || null,
    input.referenceDurationSeconds ?? input.fallbackDurationSeconds ?? null
  );
  const referenceVideoShots = parsedTimeline.shots.length > 0
    ? parsedTimeline.shots
    : buildFallbackReferenceVideoShots(input.fallbackShots, input.fallbackSummary);
  const resolvedDuration = resolveKlingDuration(
    input.referenceDurationSeconds,
    input.fallbackDurationSeconds,
    parsedTimeline.videoDurationSeconds,
    referenceVideoShots
  );
  const normalizedParts = normalizeShotDurations(referenceVideoShots, Number(resolvedDuration));
  const sceneBuckets = partitionSceneBuckets(normalizedParts);

  return {
    duration: resolvedDuration,
    scenes: sceneBuckets.map((bucket) => bucketToDraftSeedScene(bucket, fallbackLanguage)),
  };
}
