'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CLONE_PROMPT_SHOT_FIELDS,
  PromptFieldLabel,
  PromptShotLabel,
  promptUi
} from '@/components/project-agent/prompt-ui';

type MentionOption = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

export type CloneExecutionSegmentPrompt = {
  first_frame_description: string;
  is_continuation_from_prev?: boolean;
  shots: Array<{
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
  }>;
};

export type CloneExecutionSegment = {
  segmentIndex: number;
  status: string;
  firstFrameTaskId?: string | null;
  firstFrameUrl?: string | null;
  videoUrl?: string | null;
  errorMessage?: string | null;
  prompt?: CloneExecutionSegmentPrompt;
};

type CloneSceneReviewStepProps = {
  execution: {
    projectId: string;
    phase: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'merging' | 'completed' | 'failed';
    segments?: CloneExecutionSegment[];
  };
  characterMentions: MentionOption[];
  productMentions: MentionOption[];
  preferredFrameRegeneratingSceneIndex?: number | null;
};

type SceneProgressState = 'queued' | 'generating' | 'ready' | 'failed' | 'waiting';

const sceneProgressLabel = (kind: 'frame' | 'video', state: SceneProgressState) => {
  if (kind === 'frame') {
    if (state === 'ready') return 'Frame ready';
    if (state === 'generating') return 'Frame generating';
    if (state === 'failed') return 'Frame failed';
    return 'Frame queued';
  }
  if (state === 'ready') return 'Video ready';
  if (state === 'generating') return 'Video generating';
  if (state === 'failed') return 'Video failed';
  if (state === 'waiting') return 'Video waiting';
  return 'Video queued';
};

const badgeClassForState = (state: SceneProgressState) => {
  if (state === 'ready') return 'border-[#cce9d4] bg-[#eef8f1] text-[#1f7a3b]';
  if (state === 'generating') return 'border-[#d9d9d7] bg-[#f3f3f2] text-[#5b5b59]';
  if (state === 'failed') return 'border-[#efc9c9] bg-[#fff3f3] text-[#b23b3b]';
  if (state === 'waiting') return 'border-[#e3e3e1] bg-[#f8f8f7] text-[#7a7a77]';
  return 'border-[#e3e3e1] bg-[#f8f8f7] text-[#7a7a77]';
};

const normalizePrompt = (segment: CloneExecutionSegment): CloneExecutionSegmentPrompt => {
  if (segment.prompt?.shots?.length) {
    return segment.prompt;
  }

  return {
    first_frame_description: '',
    is_continuation_from_prev: segment.segmentIndex > 0,
    shots: [{
      id: 1,
      time_range: '00:00 - 00:08',
      subject: '',
      context_environment: '',
      action: '',
      style: '',
      camera_motion_positioning: '',
      composition: '',
      ambiance_colour_lighting: '',
      audio: '',
      dialogue: '',
      language: 'en'
    }]
  };
};

export default function CloneSceneReviewStep({
  execution,
  characterMentions,
  productMentions,
  preferredFrameRegeneratingSceneIndex = null
}: CloneSceneReviewStepProps) {
  const [localPrompts, setLocalPrompts] = useState<Record<number, CloneExecutionSegmentPrompt>>({});
  const [openShots, setOpenShots] = useState<Record<string, boolean>>({});
  const [frameOverlayVisible, setFrameOverlayVisible] = useState<Record<number, boolean>>({});
  const frameOverlayHideTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const prefersReducedMotion = useReducedMotion();
  const segments = useMemo(() => execution.segments || [], [execution.segments]);
  const hasExplicitRegenerateTarget = (
    typeof preferredFrameRegeneratingSceneIndex === 'number' &&
    preferredFrameRegeneratingSceneIndex > 0
  );

  useEffect(() => {
    setLocalPrompts((prev) => {
      const next: Record<number, CloneExecutionSegmentPrompt> = {};
      segments.forEach((segment) => {
        next[segment.segmentIndex] = prev[segment.segmentIndex] || normalizePrompt(segment);
      });
      return next;
    });
  }, [segments]);

  useEffect(() => {
    const hideTimers = frameOverlayHideTimersRef.current;
    const hasPreferredTarget = typeof preferredFrameRegeneratingSceneIndex === 'number' && preferredFrameRegeneratingSceneIndex > 0;
    const isFrameGenerationPhase = execution.phase === 'generating_frames' || execution.phase === 'reviewing_frames';

    const nextIndices = new Set(segments.map((segment) => segment.segmentIndex));
    Object.entries(hideTimers).forEach(([key, timer]) => {
      const segmentIndex = Number(key);
      if (!nextIndices.has(segmentIndex)) {
        clearTimeout(timer);
        delete hideTimers[segmentIndex];
      }
    });

    segments.forEach((segment) => {
      const segmentIndex = segment.segmentIndex;
      const isGenerating = segment.status === 'generating_first_frame';
      const matchesPreferred = (
        preferredFrameRegeneratingSceneIndex === null ||
        segmentIndex + 1 === preferredFrameRegeneratingSceneIndex
      );
      const shouldShowOverlay = isFrameGenerationPhase && isGenerating && (hasPreferredTarget ? matchesPreferred : true);

      if (shouldShowOverlay) {
        if (hideTimers[segmentIndex]) {
          clearTimeout(hideTimers[segmentIndex]);
          delete hideTimers[segmentIndex];
        }
        setFrameOverlayVisible((prev) => (prev[segmentIndex] ? prev : { ...prev, [segmentIndex]: true }));
        return;
      }

      if (hideTimers[segmentIndex]) {
        return;
      }

      if (hasPreferredTarget) {
        // Strict mode: when user specified a target scene, only that scene may animate.
        // If target is not yet generating, keep all overlays hidden (no fallback to other scenes).
        setFrameOverlayVisible((prev) => {
          if (!prev[segmentIndex]) return prev;
          return { ...prev, [segmentIndex]: false };
        });
        return;
      }

      // Keep overlay visible briefly after status flips to avoid jitter/flicker from polling races.
      hideTimers[segmentIndex] = setTimeout(() => {
        setFrameOverlayVisible((prev) => {
          if (!prev[segmentIndex]) return prev;
          return { ...prev, [segmentIndex]: false };
        });
        delete hideTimers[segmentIndex];
      }, 700);
    });
  }, [execution.phase, preferredFrameRegeneratingSceneIndex, segments]);

  useEffect(() => () => {
    Object.values(frameOverlayHideTimersRef.current).forEach((timer) => clearTimeout(timer));
    frameOverlayHideTimersRef.current = {};
  }, []);

  const headerLabel = useMemo(() => {
    if (execution.phase === 'generating_frames') return 'Generating scene frames. Videos will start after frame readiness.';
    if (execution.phase === 'reviewing_frames') return 'Review frames and trigger video generation when ready.';
    if (execution.phase === 'generating_videos') return 'Generating videos for each scene.';
    if (execution.phase === 'merging') return 'Merging segments...';
    if (execution.phase === 'completed') return 'Generation completed.';
    if (execution.phase === 'failed') return 'Generation failed.';
    return 'Preparing scenes...';
  }, [execution.phase]);

  const progressSummary = useMemo(() => {
    const total = segments.length;
    const framesReady = segments.filter((segment) => Boolean(segment.firstFrameUrl)).length;
    const videosReady = segments.filter((segment) => Boolean(segment.videoUrl)).length;
    return { total, framesReady, videosReady };
  }, [segments]);

  const updatePrompt = (segmentIndex: number, updater: (current: CloneExecutionSegmentPrompt) => CloneExecutionSegmentPrompt) => {
    setLocalPrompts((prev) => ({
      ...prev,
      [segmentIndex]: updater(prev[segmentIndex] || normalizePrompt({ segmentIndex, status: 'queued' }))
    }));
  };

  const toggleShot = (segmentIndex: number, shotIndex: number) => {
    const key = `${segmentIndex}-${shotIndex}`;
    setOpenShots((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className={`${promptUi.frame} max-w-full`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Step 4</p>
          <p className="text-sm font-semibold text-[#2a2a28] inline-flex items-center gap-1.5">
            <Clapperboard className="h-4 w-4" />
            Scene Generation Review
          </p>
          <p className="text-xs text-[#787876] mt-1">{headerLabel}</p>
        </div>
        <div className="inline-flex items-center gap-2 text-[11px] text-[#6a6a68]">
          <span className="rounded-full border border-[#e3e3e1] bg-[#f8f8f7] px-2 py-0.5">
            Frames {progressSummary.framesReady}/{progressSummary.total}
          </span>
          <span className="rounded-full border border-[#e3e3e1] bg-[#f8f8f7] px-2 py-0.5">
            Videos {progressSummary.videosReady}/{progressSummary.total}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {segments.map((segment) => {
          const prompt = localPrompts[segment.segmentIndex] || normalizePrompt(segment);
          const showFrameOverlay =
            execution.phase !== 'generating_videos' &&
            frameOverlayVisible[segment.segmentIndex] === true;
          const frameOverlayText = hasExplicitRegenerateTarget
            ? 'Regenerating this frame...'
            : 'Generating first frame...';
          const shouldShowVideoGenerating =
            !segment.videoUrl &&
            (
              segment.status === 'generating_video' ||
              (execution.phase === 'generating_videos' && segment.status !== 'failed')
            );
          const frameState: SceneProgressState =
            segment.status === 'failed' && !segment.firstFrameUrl
              ? 'failed'
              : segment.firstFrameUrl
                ? 'ready'
                : (
                    segment.status === 'generating_first_frame' ||
                    execution.phase === 'generating_frames'
                  )
                  ? 'generating'
                  : 'queued';
          const videoState: SceneProgressState =
            segment.status === 'failed' && Boolean(segment.firstFrameUrl) && !segment.videoUrl
              ? 'failed'
              : segment.videoUrl
                ? 'ready'
                : shouldShowVideoGenerating
                  ? 'generating'
                  : segment.firstFrameUrl
                    ? (
                        execution.phase === 'reviewing_frames'
                          ? 'queued'
                          : 'waiting'
                      )
                    : 'waiting';
          return (
            <div key={segment.segmentIndex} className={`${promptUi.sectionCard} p-3 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#454543]" />
                  <span className="text-sm font-semibold text-[#1f1f1e]">Scene {segment.segmentIndex + 1}</span>
                </div>
                <div className="inline-flex items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${badgeClassForState(frameState)}`}>
                    {frameState === 'ready' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : frameState === 'generating' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : frameState === 'failed' ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : null}
                    {sceneProgressLabel('frame', frameState)}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${badgeClassForState(videoState)}`}>
                    {videoState === 'ready' ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : videoState === 'generating' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : videoState === 'failed' ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : null}
                    {sceneProgressLabel('video', videoState)}
                  </span>
                  {segment.errorMessage ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center text-[#b23b3b]"
                          aria-label={`Scene ${segment.segmentIndex + 1} failure details`}
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={8} className="max-w-[320px] whitespace-normal leading-5">
                        {segment.errorMessage}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              </div>

              <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.5fr)] lg:h-[clamp(520px,68vh,820px)]">
                <div className="flex min-h-[360px] flex-col gap-1 lg:min-h-0 lg:h-full">
                  <PromptFieldLabel icon={ImageIcon}>Frame Preview</PromptFieldLabel>
                  <div className="w-full aspect-[9/16] lg:aspect-auto lg:flex-1 lg:min-h-0">
                    {segment.firstFrameUrl ? (
                      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[#e6e6e4] bg-[#f3f3f2]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={segment.firstFrameUrl}
                          alt={`Scene ${segment.segmentIndex + 1} frame`}
                          className="h-full w-full object-cover"
                        />
                        <div
                          className={`pointer-events-none absolute inset-x-3 bottom-3 inline-flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm transition-all duration-300 ${
                            showFrameOverlay
                              ? 'opacity-100 translate-y-0'
                              : 'opacity-0 translate-y-1'
                          }`}
                        >
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            {frameOverlayText}
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-full w-full overflow-hidden rounded-2xl border border-dashed border-[#d9d9d7] bg-[#f7f7f5]">
                        {showFrameOverlay ? (
                          <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
                            <div className="inline-flex items-center text-xs text-[#8d8d8a]">
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              Frame is generating...
                            </div>
                            <div className="mt-3 w-[68%] space-y-1.5">
                              <div className="h-1.5 rounded-full bg-[#e2e2df] animate-pulse" />
                              <div className="h-1.5 w-[82%] rounded-full bg-[#e2e2df] animate-pulse" />
                              <div className="h-1.5 w-[58%] rounded-full bg-[#e2e2df] animate-pulse" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-[#8d8d8a]">
                            <ImageIcon className="mr-1 h-4 w-4" />
                            Frame preview will appear here
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex min-h-[360px] flex-col gap-1 lg:min-h-0 lg:h-full">
                  <PromptFieldLabel icon={Clapperboard}>Video Preview</PromptFieldLabel>
                  <div className="w-full aspect-[9/16] lg:aspect-auto lg:flex-1 lg:min-h-0">
                    {segment.videoUrl ? (
                      <video
                        src={segment.videoUrl}
                        controls
                        className="h-full w-full rounded-2xl border border-[#e6e6e4] bg-black object-cover"
                      />
                    ) : (
                      <div className="h-full w-full rounded-2xl border border-dashed border-[#d9d9d7] bg-[#f7f7f5] flex items-center justify-center text-xs text-[#8d8d8a]">
                        {shouldShowVideoGenerating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Video is generating...
                          </>
                        ) : !segment.firstFrameUrl ? (
                          <>
                            <Clapperboard className="h-4 w-4 mr-1" />
                            Video waits for frame readiness
                          </>
                        ) : execution.phase === 'reviewing_frames' ? (
                          <>
                            <Clapperboard className="h-4 w-4 mr-1" />
                            Video is queued until you start video generation
                          </>
                        ) : (
                          <>
                            <Clapperboard className="h-4 w-4 mr-1" />
                            Video preview will appear here
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex min-h-[420px] flex-col gap-3 lg:min-h-0 lg:h-full">
                  <div>
                    <PromptFieldLabel icon={ImageIcon}>Image Prompt</PromptFieldLabel>
                    <PromptMentionTextarea
                      value={prompt.first_frame_description}
                      rows={5}
                      resizable="vertical"
                      allowWrappedMentions
                      preventHorizontalScroll
                      className={promptUi.fieldInput}
                      onChange={(next) => updatePrompt(segment.segmentIndex, (current) => ({ ...current, first_frame_description: next }))}
                      characterMentions={characterMentions}
                      productMentions={productMentions}
                    />
                  </div>

                  <PromptShotLabel>Video Prompt (Shot Fields)</PromptShotLabel>
                  <div className="max-h-[520px] overflow-y-auto pr-1 space-y-3 lg:max-h-none lg:min-h-0 lg:flex-1">
                    {prompt.shots.map((shot, shotIndex) => (
                      <div key={`${segment.segmentIndex}-${shot.id}-${shotIndex}`} className={promptUi.shotCard}>
                        {(() => {
                          const shotKey = `${segment.segmentIndex}-${shotIndex}`;
                          const shotExpanded = openShots[shotKey] ?? shotIndex === 0;
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleShot(segment.segmentIndex, shotIndex)}
                                className="group w-full text-left inline-flex items-center justify-between gap-2"
                                aria-expanded={shotExpanded}
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6f6d]">Shot {shotIndex + 1}</p>
                                <ChevronDown className={`h-4 w-4 text-[#787876] transition-transform duration-200 ease-out group-hover:text-[#1f1f1e] ${shotExpanded ? 'rotate-180' : 'rotate-0'}`} />
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
                                    className="overflow-hidden"
                                  >
                                    <div className="grid gap-2 md:grid-cols-2">
                                      {CLONE_PROMPT_SHOT_FIELDS.map((field) => (
                                        <div key={`${segment.segmentIndex}-${shot.id}-${field.key}`} className="min-w-0">
                                          <PromptFieldLabel icon={field.icon}>{field.label}</PromptFieldLabel>
                                          <PromptMentionTextarea
                                            value={String(shot[field.key] ?? '')}
                                            rows={2}
                                            resizable="vertical"
                                            allowWrappedMentions
                                            preventHorizontalScroll
                                            className={promptUi.shotFieldInput}
                                            onChange={(next) => updatePrompt(segment.segmentIndex, (current) => ({
                                              ...current,
                                              shots: current.shots.map((item, index) => (
                                                index === shotIndex
                                                  ? { ...item, [field.key]: next }
                                                  : item
                                              ))
                                            }))}
                                            characterMentions={characterMentions}
                                            productMentions={productMentions}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
