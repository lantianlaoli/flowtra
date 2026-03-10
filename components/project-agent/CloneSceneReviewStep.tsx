'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Image as ImageIcon,
  Loader2,
  Sparkles
} from 'lucide-react';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CLONE_PROMPT_SHOT_FIELD_GROUPS,
  PromptFieldLabel,
  PromptSectionHeading,
  PromptShotLabel,
  PromptTimeLabel,
  promptUi
} from '@/components/project-agent/prompt-ui';
import {
  createProjectAgentCloneShot,
  type ProjectAgentCloneShot
} from '@/lib/project-agent/clone-prompt-schema';

type MentionOption = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

export type CloneExecutionSegmentPrompt = {
  first_frame_description: string;
  is_continuation_from_prev?: boolean;
  shots: ProjectAgentCloneShot[];
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
    shots: [createProjectAgentCloneShot(1)]
  };
};

export default function CloneSceneReviewStep({
  execution,
  characterMentions,
  productMentions,
  preferredFrameRegeneratingSceneIndex = null
}: CloneSceneReviewStepProps) {
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
        setFrameOverlayVisible((prev) => {
          if (!prev[segmentIndex]) return prev;
          return { ...prev, [segmentIndex]: false };
        });
        return;
      }

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
    if (execution.phase === 'merging') return 'Creating the final video...';
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
          const prompt = normalizePrompt(segment);
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
                </div>
              </div>

              {(segment.errorMessage && frameState === 'failed') || (segment.errorMessage && videoState === 'failed') ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex cursor-help items-center gap-1 text-xs text-[#b23b3b]">
                      <AlertCircle className="h-3.5 w-3.5" />
                      View failure details
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={8} className="max-w-[320px] whitespace-normal leading-5">
                    {segment.errorMessage}
                  </TooltipContent>
                </Tooltip>
              ) : null}

              <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,1.5fr)]">
                <div className="flex min-h-[340px] flex-col gap-1">
                  <PromptFieldLabel icon={ImageIcon}>Frame Preview</PromptFieldLabel>
                  <div className="relative flex-1 overflow-hidden rounded-2xl border border-[#e6e6e4] bg-[#f3f3f2] min-h-[300px]">
                    {segment.firstFrameUrl ? (
                      <>
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
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-[#8d8d8a]">
                        {frameState === 'generating' ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            First frame is generating...
                          </>
                        ) : (
                          <>
                            <ImageIcon className="mr-1 h-4 w-4" />
                            Frame preview will appear here automatically.
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex min-h-[340px] flex-col gap-1">
                  <PromptFieldLabel icon={Clapperboard}>Video Preview</PromptFieldLabel>
                  <div className="flex-1 overflow-hidden rounded-2xl border border-[#e6e6e4] bg-[#f3f3f2] min-h-[300px]">
                    {segment.videoUrl ? (
                      <video
                        src={segment.videoUrl}
                        controls
                        className="h-full w-full bg-black object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-[#8d8d8a]">
                        {videoState === 'generating' ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            Scene video is generating...
                          </>
                        ) : (
                          <>
                            <Clapperboard className="mr-1 h-4 w-4" />
                            Video preview will appear here after video generation starts.
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <PromptFieldLabel icon={ImageIcon}>Image Prompt</PromptFieldLabel>
                    <PromptMentionTextarea
                      value={prompt.first_frame_description}
                      onChange={() => undefined}
                      readOnly
                      rows={4}
                      allowWrappedMentions
                      preventHorizontalScroll
                      className={promptUi.fieldInput}
                      characterMentions={characterMentions}
                      productMentions={productMentions}
                    />
                  </div>

                  <PromptShotLabel>Structured Shot Prompts</PromptShotLabel>
                  <div className="space-y-3">
                    {prompt.shots.map((shot, shotIndex) => {
                      const shotKey = `${segment.segmentIndex}-${shotIndex}`;
                      const shotExpanded = openShots[shotKey] ?? shotIndex === 0;

                      return (
                        <div key={`${segment.segmentIndex}-${shot.id}-${shotIndex}`} className={promptUi.shotCard}>
                          <button
                            type="button"
                            onClick={() => toggleShot(segment.segmentIndex, shotIndex)}
                            className="group flex w-full items-center justify-between gap-2 text-left"
                            aria-expanded={shotExpanded}
                          >
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6f6d]">
                                Shot {shotIndex + 1}
                              </p>
                              <PromptTimeLabel>{shot.time_range}</PromptTimeLabel>
                            </div>
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
                                <div className="mt-2 space-y-3">
                                  {CLONE_PROMPT_SHOT_FIELD_GROUPS.map((group) => (
                                    <div key={`${segment.segmentIndex}-${shot.id}-${group.key}`} className="rounded-2xl border border-[#e8e8e5] bg-white p-3 space-y-3">
                                      <PromptSectionHeading
                                        icon={group.icon}
                                        title={group.label}
                                        description={group.description}
                                      />
                                      <div className="grid gap-2 md:grid-cols-2">
                                        {group.fields.map((field) => (
                                          <div key={`${segment.segmentIndex}-${shot.id}-${field.key}`} className="min-w-0">
                                            <PromptFieldLabel icon={field.icon}>{field.label}</PromptFieldLabel>
                                            <PromptMentionTextarea
                                              value={String(shot[field.key] ?? '')}
                                              onChange={() => undefined}
                                              readOnly
                                              rows={2}
                                              allowWrappedMentions
                                              preventHorizontalScroll
                                              className={promptUi.shotFieldInput}
                                              characterMentions={characterMentions}
                                              productMentions={productMentions}
                                            />
                                          </div>
                                        ))}
                                      </div>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
