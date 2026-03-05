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
  Sparkles,
  TextQuote
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

export type WorkspaceShot = {
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

export type WorkspaceScene = {
  sceneIndex: number;
  imagePrompt: string;
  shots: WorkspaceShot[];
  sourceSummary?: string | null;
  firstFrameTaskId?: string | null;
  frameUrl?: string | null;
  videoUrl?: string | null;
  frameError?: string | null;
  videoError?: string | null;
  segmentStatus?: string | null;
  isContinuation?: boolean;
};

type WorkspacePhase =
  | 'draft_ready'
  | 'generating_frames'
  | 'reviewing_frames'
  | 'generating_videos'
  | 'awaiting_merge'
  | 'merging'
  | 'completed'
  | 'failed';

type CloneSceneWorkspaceStepProps = {
  phase: WorkspacePhase;
  scenes: WorkspaceScene[];
  characterMentions: MentionOption[];
  productMentions: MentionOption[];
  preferredFrameRegeneratingSceneIndex?: number | null;
  onScenesChange?: (scenes: WorkspaceScene[]) => void;
};

type SceneProgressState = 'queued' | 'generating' | 'ready' | 'failed' | 'waiting';

const normalizeShot = (shot: Partial<WorkspaceShot> | undefined, index: number): WorkspaceShot => ({
  id: Number.isFinite(Number(shot?.id)) && Number(shot?.id) > 0 ? Number(shot?.id) : index + 1,
  time_range: shot?.time_range || '00:00 - 00:08',
  subject: shot?.subject || '',
  context_environment: shot?.context_environment || '',
  action: shot?.action || '',
  style: shot?.style || '',
  camera_motion_positioning: shot?.camera_motion_positioning || '',
  composition: shot?.composition || '',
  ambiance_colour_lighting: shot?.ambiance_colour_lighting || '',
  audio: shot?.audio || '',
  dialogue: shot?.dialogue || '',
  language: shot?.language || 'en'
});

const normalizeScene = (scene: WorkspaceScene): WorkspaceScene => ({
  ...scene,
  imagePrompt: scene.imagePrompt || '',
  shots: (scene.shots || []).length > 0
    ? scene.shots.map((shot, index) => normalizeShot(shot, index))
    : [normalizeShot(undefined, 0)],
  frameUrl: scene.frameUrl ?? null,
  videoUrl: scene.videoUrl ?? null,
  frameError: scene.frameError ?? null,
  videoError: scene.videoError ?? null,
  segmentStatus: scene.segmentStatus ?? null,
  isContinuation: scene.sceneIndex > 1 ? Boolean(scene.isContinuation) : false
});

const mergeIncomingWithRecentLocalEdits = (prev: WorkspaceScene[], incoming: WorkspaceScene[]): WorkspaceScene[] => {
  const prevBySceneIndex = new Map(prev.map((scene) => [scene.sceneIndex, scene]));
  return incoming.map((incomingScene) => {
    const prevScene = prevBySceneIndex.get(incomingScene.sceneIndex);
    if (!prevScene) return incomingScene;

    const mergedShots = incomingScene.shots.map((incomingShot, shotIndex) => {
      const prevShot = prevScene.shots[shotIndex];
      if (!prevShot) return incomingShot;
      return {
        ...incomingShot,
        id: prevShot.id,
        time_range: prevShot.time_range,
        subject: prevShot.subject,
        context_environment: prevShot.context_environment,
        action: prevShot.action,
        style: prevShot.style,
        camera_motion_positioning: prevShot.camera_motion_positioning,
        composition: prevShot.composition,
        ambiance_colour_lighting: prevShot.ambiance_colour_lighting,
        audio: prevShot.audio,
        dialogue: prevShot.dialogue,
        language: prevShot.language
      };
    });

    return {
      ...incomingScene,
      imagePrompt: prevScene.imagePrompt,
      shots: mergedShots,
      isContinuation: prevScene.isContinuation
    };
  });
};

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

export default function CloneSceneWorkspaceStep({
  phase,
  scenes,
  characterMentions,
  productMentions,
  preferredFrameRegeneratingSceneIndex = null,
  onScenesChange
}: CloneSceneWorkspaceStepProps) {
  const [localScenes, setLocalScenes] = useState<WorkspaceScene[]>(() => scenes.map(normalizeScene));
  const [openScenes, setOpenScenes] = useState<Record<number, boolean>>({});
  const [openShots, setOpenShots] = useState<Record<string, boolean>>({});
  const [frameOverlayVisible, setFrameOverlayVisible] = useState<Record<number, boolean>>({});
  const frameOverlayHideTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const lastLocalEditAtRef = useRef(0);
  const pendingScenesChangeEmitRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  const sceneSignature = useMemo(() => JSON.stringify(scenes), [scenes]);

  useEffect(() => {
    const normalizedIncoming = scenes.map(normalizeScene);
    setLocalScenes((prev) => {
      const justEdited = Date.now() - lastLocalEditAtRef.current < 1200;
      if (!justEdited) return normalizedIncoming;
      return mergeIncomingWithRecentLocalEdits(prev, normalizedIncoming);
    });
  }, [sceneSignature, scenes]);

  const updateLocalScenes = (updater: (current: WorkspaceScene[]) => WorkspaceScene[]) => {
    lastLocalEditAtRef.current = Date.now();
    pendingScenesChangeEmitRef.current = true;
    setLocalScenes((prev) => updater(prev));
  };

  useEffect(() => {
    if (!pendingScenesChangeEmitRef.current) return;
    pendingScenesChangeEmitRef.current = false;
    onScenesChange?.(localScenes);
  }, [localScenes, onScenesChange]);

  useEffect(() => {
    const hideTimers = frameOverlayHideTimersRef.current;
    const hasPreferredTarget = typeof preferredFrameRegeneratingSceneIndex === 'number' && preferredFrameRegeneratingSceneIndex > 0;
    const isFrameGenerationPhase = phase === 'generating_frames' || phase === 'reviewing_frames';

    const nextIndices = new Set(localScenes.map((scene) => scene.sceneIndex));
    Object.entries(hideTimers).forEach(([key, timer]) => {
      const sceneIndex = Number(key);
      if (!nextIndices.has(sceneIndex)) {
        clearTimeout(timer);
        delete hideTimers[sceneIndex];
      }
    });

    localScenes.forEach((scene) => {
      const sceneIndex = scene.sceneIndex;
      const isGenerating = scene.segmentStatus === 'generating_first_frame';
      const matchesPreferred = (
        preferredFrameRegeneratingSceneIndex === null ||
        sceneIndex === preferredFrameRegeneratingSceneIndex
      );
      const shouldShowOverlay = isFrameGenerationPhase && isGenerating && (hasPreferredTarget ? matchesPreferred : true);

      if (shouldShowOverlay) {
        if (hideTimers[sceneIndex]) {
          clearTimeout(hideTimers[sceneIndex]);
          delete hideTimers[sceneIndex];
        }
        setFrameOverlayVisible((prev) => (prev[sceneIndex] ? prev : { ...prev, [sceneIndex]: true }));
        return;
      }

      if (hideTimers[sceneIndex]) return;

      if (hasPreferredTarget) {
        setFrameOverlayVisible((prev) => {
          if (!prev[sceneIndex]) return prev;
          return { ...prev, [sceneIndex]: false };
        });
        return;
      }

      hideTimers[sceneIndex] = setTimeout(() => {
        setFrameOverlayVisible((prev) => {
          if (!prev[sceneIndex]) return prev;
          return { ...prev, [sceneIndex]: false };
        });
        delete hideTimers[sceneIndex];
      }, 700);
    });
  }, [localScenes, phase, preferredFrameRegeneratingSceneIndex]);

  useEffect(() => () => {
    Object.values(frameOverlayHideTimersRef.current).forEach((timer) => clearTimeout(timer));
    frameOverlayHideTimersRef.current = {};
  }, []);

  const headerLabel = useMemo(() => {
    if (phase === 'draft_ready') return 'Edit prompts, then use chat to start generation.';
    if (phase === 'generating_frames') return 'Frame generation in progress.';
    if (phase === 'reviewing_frames') return 'Review frame results and refine prompts if needed.';
    if (phase === 'generating_videos') return 'Video generation in progress for each scene.';
    if (phase === 'awaiting_merge') return 'All scene videos are ready. You can keep regenerating scene frame/video, then confirm merge in chat.';
    if (phase === 'merging') return 'Merging scene videos...';
    if (phase === 'completed') return 'Generation completed.';
    if (phase === 'failed') return 'Generation encountered an issue.';
    return 'Edit prompts, then use chat to start frame generation.';
  }, [phase]);

  const progressSummary = useMemo(() => {
    const total = localScenes.length;
    const framesReady = localScenes.filter((scene) => Boolean(scene.frameUrl)).length;
    const videosReady = localScenes.filter((scene) => Boolean(scene.videoUrl)).length;
    return { total, framesReady, videosReady };
  }, [localScenes]);

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

  return (
    <div className={`${promptUi.frame} max-w-full`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Step 3 Workspace</p>
          <p className="text-sm font-semibold text-[#2a2a28] inline-flex items-center gap-1.5">
            <Clapperboard className="h-4 w-4" />
            Scene Workspace
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
        {localScenes.map((scene, sceneArrayIndex) => {
          const previousScene = sceneArrayIndex > 0 ? localScenes[sceneArrayIndex - 1] : null;
          const showFrameOverlay = phase !== 'generating_videos' && frameOverlayVisible[scene.sceneIndex] === true;
          const isWaitingForContinuationKickoff = Boolean(
            scene.isContinuation &&
            !scene.frameUrl &&
            !scene.videoUrl &&
            (
              scene.segmentStatus === 'awaiting_prev_first_frame' ||
              scene.segmentStatus === 'queued' ||
              scene.segmentStatus === null
            ) &&
            previousScene?.frameUrl
          );
          const hasSubmittedFrameTask = typeof scene.firstFrameTaskId === 'string' && scene.firstFrameTaskId.trim().length > 0;
          const shouldShowFrameGenerating = (
            (
              phase === 'generating_frames' &&
              scene.segmentStatus === 'generating_first_frame' &&
              hasSubmittedFrameTask
            ) ||
            (
              isWaitingForContinuationKickoff &&
              hasSubmittedFrameTask
            )
          );
          const shouldShowVideoGenerating = (
            phase === 'generating_videos' &&
            !scene.videoUrl &&
            scene.segmentStatus !== 'failed'
          ) || scene.segmentStatus === 'generating_video';
          const frameState: SceneProgressState =
            scene.segmentStatus === 'failed' && !scene.frameUrl
              ? 'failed'
              : scene.frameUrl
                ? 'ready'
                : shouldShowFrameGenerating
                  ? 'generating'
                  : 'queued';
          const videoState: SceneProgressState =
            scene.segmentStatus === 'failed' && Boolean(scene.frameUrl) && !scene.videoUrl
              ? 'failed'
              : scene.videoUrl
                ? 'ready'
                : shouldShowVideoGenerating
                  ? 'generating'
                  : scene.frameUrl
                    ? (phase === 'reviewing_frames' ? 'queued' : 'waiting')
                    : 'waiting';

          const expanded = openScenes[scene.sceneIndex] ?? scene.sceneIndex === 1;

          return (
            <div key={scene.sceneIndex} className={`${promptUi.sectionCard}`}>
              <div className="px-3 py-3 transition-colors hover:bg-[#f7f7f6]">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => toggleScene(scene.sceneIndex)}
                    className="group min-w-0 flex-1 text-left"
                    aria-expanded={expanded}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-[#454543]" />
                        <span className="text-sm font-semibold text-[#1f1f1e]">Scene {scene.sceneIndex}</span>
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
                        <ChevronDown className={`h-4 w-4 text-[#787876] transition-transform duration-200 ease-out group-hover:text-[#1f1f1e] ${expanded ? 'rotate-180' : 'rotate-0'}`} />
                      </div>
                    </div>
                    {scene.sourceSummary ? (
                      <p className="mt-1 text-[11px] text-[#787876] line-clamp-2 inline-flex items-start gap-1.5">
                        <TextQuote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[#9a9a97]" />
                        <span>{scene.sourceSummary}</span>
                      </p>
                    ) : null}
                  </button>
                  {(scene.frameError || scene.videoError) ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center text-[#b23b3b]"
                          aria-label={`Scene ${scene.sceneIndex} failure details`}
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={8} className="max-w-[320px] whitespace-normal leading-5">
                        {scene.videoError || scene.frameError}
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              </div>

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
                    <div className="p-3">
                      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.5fr)] lg:h-[clamp(520px,68vh,820px)]">
                        <div className="flex min-h-[360px] flex-col gap-1 lg:min-h-0 lg:h-full">
                          <PromptFieldLabel icon={ImageIcon}>Frame Preview</PromptFieldLabel>
                          <div className="w-full aspect-[9/16] lg:aspect-auto lg:flex-1 lg:min-h-0">
                            {scene.frameUrl ? (
                              <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[#e6e6e4] bg-[#f3f3f2]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={scene.frameUrl}
                                  alt={`Scene ${scene.sceneIndex} frame`}
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
                                  Regenerating this frame...
                                </div>
                              </div>
                            ) : (
                              <div className="h-full w-full rounded-2xl border border-dashed border-[#d9d9d7] bg-[#f7f7f5] flex items-center justify-center text-xs text-[#8d8d8a] px-4 text-center">
                                {shouldShowFrameGenerating ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    {isWaitingForContinuationKickoff && hasSubmittedFrameTask
                                      ? 'Frame generation is starting from the previous frame...'
                                      : 'Frame is generating...'}
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon className="h-4 w-4 mr-1" />
                                    {isWaitingForContinuationKickoff
                                      ? 'Frame preview will appear once the continuation task is submitted.'
                                      : 'Frame preview will appear after frame generation starts.'}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex min-h-[360px] flex-col gap-1 lg:min-h-0 lg:h-full">
                          <PromptFieldLabel icon={Clapperboard}>Video Preview</PromptFieldLabel>
                          <div className="w-full aspect-[9/16] lg:aspect-auto lg:flex-1 lg:min-h-0">
                            {scene.videoUrl ? (
                              <video
                                src={scene.videoUrl}
                                controls
                                className="h-full w-full rounded-2xl border border-[#e6e6e4] bg-black object-cover"
                              />
                            ) : (
                              <div className="h-full w-full rounded-2xl border border-dashed border-[#d9d9d7] bg-[#f7f7f5] flex items-center justify-center text-xs text-[#8d8d8a] px-4 text-center">
                                {shouldShowVideoGenerating ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Video is generating...
                                  </>
                                ) : (
                                  <>
                                    <Clapperboard className="h-4 w-4 mr-1" />
                                    Video preview will appear after video generation starts.
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex min-h-[420px] flex-col gap-3 lg:min-h-0 lg:h-full">
                          <div>
                            <div className="mb-1 flex items-center justify-between gap-3">
                              <PromptFieldLabel icon={ImageIcon}>Image Prompt</PromptFieldLabel>
                              {scene.sceneIndex > 1 ? (
                                <div className="inline-flex items-center gap-2 text-[10px] leading-none text-[#7a7a77]">
                                  <span className="whitespace-nowrap">
                                    {scene.isContinuation ? 'Linked to previous frame' : 'Independent frame'}
                                  </span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        aria-pressed={Boolean(scene.isContinuation)}
                                        aria-label="Link this scene to the previous frame"
                                        onClick={() => updateLocalScenes((current) => (
                                          current.map((item) => (
                                            item.sceneIndex === scene.sceneIndex
                                              ? { ...item, isContinuation: !item.isContinuation }
                                              : item
                                          ))
                                        ))}
                                        className={`inline-flex h-4 w-8 shrink-0 items-center rounded-full border px-0.5 transition ${
                                          scene.isContinuation
                                            ? 'border-black bg-black'
                                            : 'border-[#d7d7d4] bg-white hover:border-[#222222]'
                                        }`}
                                      >
                                        <span
                                          className={`h-3 w-3 rounded-full transition-transform ${
                                            scene.isContinuation
                                              ? 'translate-x-4 bg-white'
                                              : 'translate-x-0 bg-[#a8a8a4]'
                                          }`}
                                        />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" sideOffset={8}>
                                      {scene.isContinuation
                                        ? 'Use the previous scene first frame as reference'
                                        : 'Generate this scene without using the previous frame'}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              ) : null}
                            </div>
                            <PromptMentionTextarea
                              value={scene.imagePrompt}
                              rows={5}
                              resizable="vertical"
                              allowWrappedMentions
                              preventHorizontalScroll
                              className={promptUi.fieldInput}
                              onChange={(next) => updateLocalScenes((current) => (
                                current.map((item) => (
                                  item.sceneIndex === scene.sceneIndex
                                    ? { ...item, imagePrompt: next }
                                    : item
                                ))
                              ))}
                              characterMentions={characterMentions}
                              productMentions={productMentions}
                            />
                          </div>

                          <PromptShotLabel>Video Prompt (Shot Fields)</PromptShotLabel>
                          <div className="max-h-[520px] overflow-y-auto pr-1 space-y-3 lg:max-h-none lg:min-h-0 lg:flex-1">
                            {scene.shots.map((shot, shotIndex) => {
                              const shotKey = `${scene.sceneIndex}-${shotIndex}`;
                              const shotExpanded = openShots[shotKey] ?? shotIndex === 0;
                              return (
                                <div key={`${scene.sceneIndex}-${shot.id}-${shotIndex}`} className={promptUi.shotCard}>
                                  <button
                                    type="button"
                                    onClick={() => toggleShot(scene.sceneIndex, shotIndex)}
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
                                            <div key={`${scene.sceneIndex}-${shot.id}-${field.key}`} className="min-w-0">
                                              <PromptFieldLabel icon={field.icon}>{field.label}</PromptFieldLabel>
                                              <PromptMentionTextarea
                                                value={String(shot[field.key] ?? '')}
                                                rows={2}
                                                resizable="vertical"
                                                allowWrappedMentions
                                                preventHorizontalScroll
                                                className={promptUi.shotFieldInput}
                                                onChange={(next) => updateLocalScenes((current) => (
                                                  current.map((item) => {
                                                    if (item.sceneIndex !== scene.sceneIndex) return item;
                                                    return {
                                                      ...item,
                                                      shots: item.shots.map((shotItem, index) => (
                                                        index === shotIndex
                                                          ? { ...shotItem, [field.key]: next }
                                                          : shotItem
                                                      ))
                                                    };
                                                  })
                                                ))}
                                                characterMentions={characterMentions}
                                                productMentions={productMentions}
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
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
