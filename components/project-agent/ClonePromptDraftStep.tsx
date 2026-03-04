'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  ChevronDown,
  Clapperboard,
  Clock,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  TextQuote,
  User
} from 'lucide-react';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import ShotTimeRangeSlider, { type ShotRangeSec } from '@/components/project-agent/ShotTimeRangeSlider';
import {
  CLONE_PROMPT_SHOT_FIELDS,
  PromptFieldLabel,
  PromptShotLabel,
  PromptTimeLabel,
  promptUi
} from '@/components/project-agent/prompt-ui';

export type CloneDraftShot = {
  id: number;
  time_range: string;
  subject: string;
  context_environment: string;
  action: string;
  style: string;
  camera_motion_positioning: string;
  composition: string;
  ambiance_colour_lighting: string;
  audio: string;
  dialogue: string;
  language?: string;
};

export type CloneDraftScene = {
  sceneIndex: number;
  imagePrompt: string;
  isContinuation?: boolean;
  videoPrompt: string | { shots: CloneDraftShot[] };
  sourceSummary?: string | null;
};

export type ClonePromptDraft = {
  status: 'idle' | 'generating' | 'ready' | 'failed';
  error?: string | null;
  selectedAvatars?: Array<{
    id: string;
    name: string;
    photoUrl?: string | null;
  }>;
  selectedAvatar?: {
    id: string;
    name: string;
    photoUrl?: string | null;
  };
  selectedProducts?: Array<{
    id: string;
    name: string;
    photoUrl?: string | null;
    brandName?: string | null;
  }>;
  selectedProduct?: {
    id: string;
    name: string;
    photoUrl?: string | null;
  };
  scenes: CloneDraftScene[];
};

type MentionOption = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

type ClonePromptDraftStepProps = {
  draft: ClonePromptDraft | null;
  characterMentions: MentionOption[];
  productMentions: MentionOption[];
  enablePromptMentions?: boolean;
  onDraftChange?: (scenes: CloneDraftScene[]) => void;
  onReselect?: () => void;
};

const sceneSignature = (draft: ClonePromptDraft | null) => JSON.stringify(draft?.scenes || []);
const DEFAULT_SCENE_DURATION = 8;
const MIN_GAP_SEC = 0.2;
const TIME_STEP_SEC = 0.1;
const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe - (minutes * 60);
  const wholeSecs = Math.round(secs * 10) / 10;
  const secDisplay = wholeSecs >= 10 ? wholeSecs.toFixed(wholeSecs % 1 === 0 ? 0 : 1) : `0${wholeSecs.toFixed(wholeSecs % 1 === 0 ? 0 : 1)}`;
  return `${String(minutes).padStart(2, '0')}:${secDisplay}`;
};

const parseTime = (raw: string) => {
  const input = raw.trim();
  const [mmPart, ssPart] = input.split(':');
  const mm = Number(mmPart);
  const ss = Number(ssPart);
  if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null;
  return (mm * 60) + ss;
};

const parseTimeRange = (raw: string) => {
  const [startRaw, endRaw] = raw.split('-').map((part) => part.trim());
  if (!startRaw || !endRaw) return null;
  const start = parseTime(startRaw);
  const end = parseTime(endRaw);
  if (start === null || end === null) return null;
  if (end <= start) return null;
  return { start, end };
};

const formatTimeRange = (start: number, end: number) => `${formatTime(start)} - ${formatTime(end)}`;

const emptyShot = (id: number, text = ''): CloneDraftShot => ({
  id,
  time_range: '00:00 - 00:02',
  subject: text,
  context_environment: '',
  action: '',
  style: '',
  camera_motion_positioning: '',
  composition: '',
  ambiance_colour_lighting: '',
  audio: '',
  dialogue: '',
  language: 'en'
});

const normalizeScenes = (scenes: CloneDraftScene[]): CloneDraftScene[] => (
  scenes.map((scene) => {
    if (typeof scene.videoPrompt === 'string') {
      return {
        ...scene,
        videoPrompt: {
          shots: [emptyShot(1, scene.videoPrompt)]
        }
      };
    }

    const shots = Array.isArray(scene.videoPrompt?.shots) ? scene.videoPrompt.shots : [];
    if (shots.length > 0) {
      return {
        ...scene,
        videoPrompt: {
          shots: shots.map((shot, index) => ({
            ...shot,
            id: Number.isFinite(shot.id) && shot.id > 0 ? shot.id : index + 1
          }))
        }
      };
    }

    return {
      ...scene,
      videoPrompt: {
        shots: [emptyShot(1)]
      }
    };
  })
);

const inferSceneDuration = (shots: CloneDraftShot[]) => {
  const parsedEnds = shots
    .map((shot) => parseTimeRange(shot.time_range)?.end)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (parsedEnds.length === 0) return DEFAULT_SCENE_DURATION;
  return Math.max(DEFAULT_SCENE_DURATION, Math.ceil(Math.max(...parsedEnds)));
};

const normalizeDurations = (durations: number[], targetTotal: number, minDuration: number) => {
  if (durations.length === 0) return [] as number[];
  const safeMin = Math.min(minDuration, targetTotal / durations.length);
  const normalized = durations.map((value) => Math.max(safeMin, value));
  let sum = normalized.reduce((acc, value) => acc + value, 0);
  const epsilon = 0.0001;

  if (Math.abs(sum - targetTotal) <= epsilon) return normalized;

  if (sum < targetTotal) {
    let remaining = targetTotal - sum;
    const weights = normalized.map((value) => Math.max(0.0001, value - safeMin));
    const weightSum = weights.reduce((acc, value) => acc + value, 0) || durations.length;
    for (let index = 0; index < normalized.length; index += 1) {
      const delta = index === normalized.length - 1 ? remaining : (remaining * (weights[index] / weightSum));
      normalized[index] += delta;
      remaining -= delta;
    }
    return normalized;
  }

  let overflow = sum - targetTotal;
  const reducible = normalized.map((value) => Math.max(0, value - safeMin));
  const reducibleSum = reducible.reduce((acc, value) => acc + value, 0);
  if (reducibleSum <= epsilon) return normalized;

  for (let index = 0; index < normalized.length; index += 1) {
    const delta = index === normalized.length - 1 ? overflow : (overflow * (reducible[index] / reducibleSum));
    normalized[index] = Math.max(safeMin, normalized[index] - delta);
    overflow -= delta;
  }

  sum = normalized.reduce((acc, value) => acc + value, 0);
  const drift = targetTotal - sum;
  normalized[normalized.length - 1] = Math.max(safeMin, normalized[normalized.length - 1] + drift);

  return normalized;
};

const normalizeSceneRanges = (
  ranges: ShotRangeSec[],
  sceneDuration: number,
  minGap: number
) => {
  const durations = ranges.map((range) => Math.max(minGap, range.endSec - range.startSec));
  const normalizedDurations = normalizeDurations(durations, sceneDuration, minGap);
  let cursor = 0;
  return normalizedDurations.map((duration, index) => {
    const startSec = Number(cursor.toFixed(1));
    const endSec = index === normalizedDurations.length - 1
      ? Number(sceneDuration.toFixed(1))
      : Number((cursor + duration).toFixed(1));
    cursor += duration;
    return { startSec, endSec };
  });
};

const parseSceneRanges = (shots: CloneDraftShot[], sceneDuration: number): ShotRangeSec[] => {
  const count = Math.max(shots.length, 1);
  const segment = sceneDuration / count;
  const initial = shots.map((shot, index) => {
    const parsed = parseTimeRange(shot.time_range);
    if (parsed) {
      return {
        startSec: Number(parsed.start.toFixed(1)),
        endSec: Number(parsed.end.toFixed(1))
      };
    }

    return {
      startSec: Number((index * segment).toFixed(1)),
      endSec: Number(((index + 1) * segment).toFixed(1))
    };
  });

  return normalizeSceneRanges(initial, sceneDuration, MIN_GAP_SEC);
};

const serializeSceneRangesToShots = (
  shots: CloneDraftShot[],
  ranges: ShotRangeSec[]
) => shots.map((shot, index) => ({
  ...shot,
  time_range: formatTimeRange(ranges[index].startSec, ranges[index].endSec)
}));

const redistributeDurations = (
  baseDurations: number[],
  targetSpace: number,
  minGap: number
) => {
  if (baseDurations.length === 0) return [] as number[];
  return normalizeDurations(baseDurations, targetSpace, minGap);
};

const applyLinkedRangeChange = (
  ranges: ShotRangeSec[],
  shotIndex: number,
  nextRange: ShotRangeSec,
  sceneDuration: number,
  minGap: number
) => {
  const shotCount = ranges.length;
  const frontCount = shotIndex;
  const backCount = shotCount - shotIndex - 1;

  const minStart = frontCount * minGap;
  const maxEnd = sceneDuration - (backCount * minGap);
  const clampedStart = Math.max(minStart, Math.min(nextRange.startSec, maxEnd - minGap));
  const clampedEnd = Math.min(maxEnd, Math.max(nextRange.endSec, clampedStart + minGap));

  const frontTarget = clampedStart;
  const backTarget = sceneDuration - clampedEnd;

  if (frontCount > 0 && frontTarget < frontCount * minGap - 0.0001) return null;
  if (backCount > 0 && backTarget < backCount * minGap - 0.0001) return null;

  const frontBase = ranges.slice(0, shotIndex).map((range) => range.endSec - range.startSec);
  const backBase = ranges.slice(shotIndex + 1).map((range) => range.endSec - range.startSec);

  const frontDurations = redistributeDurations(frontBase, frontTarget, minGap);
  const backDurations = redistributeDurations(backBase, backTarget, minGap);

  const nextDurations = [
    ...frontDurations,
    clampedEnd - clampedStart,
    ...backDurations
  ];

  let cursor = 0;
  return nextDurations.map((duration, index) => {
    const startSec = Number(cursor.toFixed(1));
    const endSec = index === nextDurations.length - 1
      ? Number(sceneDuration.toFixed(1))
      : Number((cursor + duration).toFixed(1));
    cursor += duration;
    return { startSec, endSec };
  });
};

export default function ClonePromptDraftStep({
  draft,
  characterMentions,
  productMentions,
  enablePromptMentions = true,
  onDraftChange,
  onReselect
}: ClonePromptDraftStepProps) {
  const [localScenes, setLocalScenes] = useState<CloneDraftScene[]>(normalizeScenes(draft?.scenes || []));
  const [pendingSyncVersion, setPendingSyncVersion] = useState(0);
  const [openScenes, setOpenScenes] = useState<Record<number, boolean>>({});
  const [openShots, setOpenShots] = useState<Record<string, boolean>>({});
  const prefersReducedMotion = useReducedMotion();
  const mentionPropsForAllFields = enablePromptMentions
    ? { characterMentions, productMentions, allowWrappedMentions: true, preventHorizontalScroll: true }
    : { characterMentions: [], productMentions: [], allowWrappedMentions: true, preventHorizontalScroll: true };
  const sanitizeScenesForModel = useMemo(() => (
    (scenes: CloneDraftScene[]) => {
      return scenes.map((scene) => ({
        ...scene,
        imagePrompt: scene.imagePrompt || '',
        videoPrompt: typeof scene.videoPrompt === 'string'
          ? {
              shots: [emptyShot(1, scene.videoPrompt)]
            }
          : {
              shots: (scene.videoPrompt.shots || []).map((shot, index) => ({
                ...shot,
                id: Number.isFinite(shot.id) && shot.id > 0 ? shot.id : index + 1
              }))
            }
      }));
    }
  ), []);

  const signature = useMemo(() => sceneSignature(draft), [draft]);

  useEffect(() => {
    setLocalScenes(sanitizeScenesForModel(normalizeScenes(draft?.scenes || [])));
    setPendingSyncVersion(0);
    setOpenScenes({});
  }, [signature, sanitizeScenesForModel]);

  useEffect(() => {
    if (!onDraftChange || pendingSyncVersion === 0) return;
    onDraftChange(localScenes);
  }, [localScenes, onDraftChange, pendingSyncVersion]);

  const toggleScene = (sceneIndex: number) => {
    setOpenScenes((prev) => ({
      ...prev,
      [sceneIndex]: !prev[sceneIndex]
    }));
  };

  const toggleShot = (sceneIndex: number, shotIndex: number) => {
    const key = `${sceneIndex}-${shotIndex}`;
    setOpenShots((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const updateSceneImage = (sceneIndex: number, imagePrompt: string) => {
    setLocalScenes((prev) => {
      const nextScenes = prev.map((scene) => (
        scene.sceneIndex === sceneIndex ? { ...scene, imagePrompt } : scene
      ));
      return nextScenes;
    });
    setPendingSyncVersion((version) => version + 1);
  };

  const updateShot = (
    sceneIndex: number,
    shotIndex: number,
    patch: Partial<CloneDraftShot>
  ) => {
    setLocalScenes((prev) => {
      const nextScenes = prev.map((scene) => {
        if (scene.sceneIndex !== sceneIndex) return scene;
        const normalized = typeof scene.videoPrompt === 'string'
          ? { shots: [emptyShot(1, scene.videoPrompt)] }
          : { shots: scene.videoPrompt.shots.map((shot) => ({ ...shot })) };

        normalized.shots[shotIndex] = {
          ...normalized.shots[shotIndex],
          ...patch,
          id: normalized.shots[shotIndex].id || shotIndex + 1
        };

        return {
          ...scene,
          videoPrompt: normalized
        };
      });
      return nextScenes;
    });
    setPendingSyncVersion((version) => version + 1);
  };

  const updateLinkedShotRange = (
    sceneIndex: number,
    shotIndex: number,
    nextRange: ShotRangeSec
  ) => {
    setLocalScenes((prev) => {
      const nextScenes = prev.map((scene) => {
        if (scene.sceneIndex !== sceneIndex) return scene;
        const normalized = typeof scene.videoPrompt === 'string'
          ? { shots: [emptyShot(1, scene.videoPrompt)] }
          : { shots: scene.videoPrompt.shots.map((shot) => ({ ...shot })) };

        const sceneDuration = inferSceneDuration(normalized.shots);
        const currentRanges = parseSceneRanges(normalized.shots, sceneDuration);
        const nextRanges = applyLinkedRangeChange(
          currentRanges,
          shotIndex,
          nextRange,
          sceneDuration,
          MIN_GAP_SEC
        );

        if (!nextRanges) return scene;

        return {
          ...scene,
          videoPrompt: {
            shots: serializeSceneRangesToShots(normalized.shots, nextRanges)
          }
        };
      });
      return nextScenes;
    });
    setPendingSyncVersion((version) => version + 1);
  };

  return (
    <div className={promptUi.frame}>
      <div className="flex items-start gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Step 3</p>
          <p className="text-sm font-semibold text-[#2a2a28] inline-flex items-center gap-1.5">
            <Clapperboard className="h-4 w-4" />
            Review Replaced Prompts
          </p>
        </div>
      </div>

      {draft?.status === 'generating' ? (
        <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-5 text-xs text-[#787876] inline-flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Working on it...
        </div>
      ) : null}

      {draft?.status === 'failed' ? (
        <div className="rounded-xl border border-[#f1d5d5] bg-[#fff6f6] px-4 py-4 text-xs text-[#9a3a3a] space-y-3">
          <p className="inline-flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{draft.error || 'Failed to regenerate prompts. Please retry.'}</span>
          </p>
          {onReselect ? (
            <button
              type="button"
              onClick={onReselect}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#e4bcbc] bg-white px-2.5 py-1.5 text-xs text-[#7a2d2d] hover:bg-[#fff4f4]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reselect Replacements
            </button>
          ) : null}
        </div>
      ) : null}

      {localScenes.length > 0 ? (
        <div className="space-y-3">
          {localScenes.map((scene) => {
            const expanded = openScenes[scene.sceneIndex] ?? scene.sceneIndex === 1;
            const shots = typeof scene.videoPrompt === 'string' ? [emptyShot(1, scene.videoPrompt)] : scene.videoPrompt.shots;
            const sceneDuration = inferSceneDuration(shots);
            const sceneRanges = parseSceneRanges(shots, sceneDuration);

            return (
              <div key={scene.sceneIndex} className={promptUi.sectionCard}>
                <button
                  type="button"
                  onClick={() => toggleScene(scene.sceneIndex)}
                  className="group w-full px-3 py-3 text-left transition-colors hover:bg-[#f7f7f6]"
                  aria-expanded={expanded}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#1f1f1e] inline-flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Scene {scene.sceneIndex}
                    </p>
                    <ChevronDown className={`h-4 w-4 text-[#787876] transition-transform duration-200 ease-out group-hover:text-[#1f1f1e] ${expanded ? 'rotate-180' : 'rotate-0'}`} />
                  </div>
                  {scene.sourceSummary ? (
                    <p className="mt-1 text-[11px] text-[#787876] line-clamp-2 inline-flex items-start gap-1.5">
                      <TextQuote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#9a9a97]" />
                      <span>{scene.sourceSummary}</span>
                    </p>
                  ) : null}
                </button>

                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div
                      key={`scene-${scene.sceneIndex}-body`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="border-t border-[#ececea]"
                    >
                      <div className="p-3 space-y-4">
                        <div className={promptUi.block}>
                          <PromptFieldLabel icon={ImageIcon}>Image Prompt</PromptFieldLabel>
                          <PromptMentionTextarea
                            value={scene.imagePrompt}
                            onChange={(next) => updateSceneImage(scene.sceneIndex, next)}
                            rows={5}
                            resizable="vertical"
                            allowWrappedMentions
                            preventHorizontalScroll
                            className={promptUi.fieldInput}
                            characterMentions={characterMentions}
                            productMentions={productMentions}
                          />
                        </div>

                        <div className={`${promptUi.block} space-y-3`}>
                          <PromptShotLabel>Video Prompt (Shot Fields)</PromptShotLabel>

                          <div className="h-[520px] overflow-y-auto pr-1 space-y-3">
                            {shots.map((shot, shotIndex) => {
                              const currentRange = sceneRanges[shotIndex];
                              const frontCount = shotIndex;
                              const backCount = sceneRanges.length - shotIndex - 1;
                              const minStart = frontCount * MIN_GAP_SEC;
                              const maxEnd = sceneDuration - (backCount * MIN_GAP_SEC);
                              const shotKey = `${scene.sceneIndex}-${shotIndex}`;
                              const shotExpanded = openShots[shotKey] ?? shotIndex === 0;

                              return (
                                <div key={`${scene.sceneIndex}-${shotIndex}`} className={promptUi.shotCard}>
                                  <button
                                    type="button"
                                    onClick={() => toggleShot(scene.sceneIndex, shotIndex)}
                                    className="group w-full text-left inline-flex items-center justify-between gap-2"
                                    aria-expanded={shotExpanded}
                                  >
                                    <p className="text-xs font-semibold text-[#1f1f1e] inline-flex items-center gap-1.5">
                                      <Sparkles className="h-3.5 w-3.5" />
                                      Shot {shotIndex + 1}
                                    </p>
                                    <span className="inline-flex items-center gap-2">
                                      <PromptTimeLabel>
                                        {formatTimeRange(currentRange.startSec, currentRange.endSec)}
                                      </PromptTimeLabel>
                                      <ChevronDown className={`h-4 w-4 text-[#787876] transition-transform duration-200 ease-out group-hover:text-[#1f1f1e] ${shotExpanded ? 'rotate-180' : 'rotate-0'}`} />
                                    </span>
                                  </button>

                                  <AnimatePresence initial={false}>
                                    {shotExpanded ? (
                                      <motion.div
                                        key={`shot-${shotKey}-body`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={prefersReducedMotion
                                          ? { duration: 0 }
                                          : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                        className="space-y-3 overflow-hidden"
                                      >
                                        <div>
                                          <PromptFieldLabel icon={Clock}>Time Range</PromptFieldLabel>
                                          <ShotTimeRangeSlider
                                            ranges={sceneRanges}
                                            selectedIndex={shotIndex}
                                            sceneDurationSec={sceneDuration}
                                            minStartSec={minStart}
                                            maxEndSec={maxEnd}
                                            stepSec={TIME_STEP_SEC}
                                            minGapSec={MIN_GAP_SEC}
                                            onChange={({ startSec, endSec }) => {
                                              updateLinkedShotRange(scene.sceneIndex, shotIndex, {
                                                startSec,
                                                endSec
                                              });
                                            }}
                                          />
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                          <div className="min-w-0 lg:col-span-2">
                                            <PromptFieldLabel icon={User}>Subject</PromptFieldLabel>
                                            <PromptMentionTextarea value={shot.subject} onChange={(next) => updateShot(scene.sceneIndex, shotIndex, { subject: next })} rows={2} resizable="vertical" className={promptUi.shotFieldInput} {...mentionPropsForAllFields} />
                                          </div>
                                          {CLONE_PROMPT_SHOT_FIELDS.filter((field) => field.key !== 'subject').map((field) => (
                                            <div key={`${scene.sceneIndex}-${shotIndex}-${field.key}`} className="min-w-0">
                                              <PromptFieldLabel icon={field.icon}>{field.label}</PromptFieldLabel>
                                              <PromptMentionTextarea
                                                value={String(shot[field.key] ?? '')}
                                                onChange={(next) => updateShot(scene.sceneIndex, shotIndex, { [field.key]: next })}
                                                rows={2}
                                                resizable="vertical"
                                                className={promptUi.shotFieldInput}
                                                {...mentionPropsForAllFields}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </motion.div>
                                    ) : null}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ) : draft?.status === 'ready' ? (
        <div className="rounded-xl border border-dashed border-[#dfdfdc] bg-[#f7f7f5] px-4 py-5 text-xs text-[#787876]">
          No regenerated prompts yet.
        </div>
      ) : null}

    </div>
  );
}
