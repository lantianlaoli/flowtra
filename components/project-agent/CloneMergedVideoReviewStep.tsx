'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, ChevronDown, Clapperboard, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';
import {
  CLONE_PROMPT_SHOT_FIELDS,
  PromptFieldLabel,
  PromptShotLabel,
  promptUi
} from '@/components/project-agent/prompt-ui';
import type { CloneExecutionSegment, CloneExecutionSegmentPrompt } from '@/components/project-agent/CloneSceneReviewStep';

type MentionOption = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

type CloneMergedVideoReviewStepProps = {
  execution: {
    projectId: string;
    phase: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'awaiting_merge' | 'merging' | 'completed' | 'failed';
    mergedVideoUrl?: string | null;
    segments?: CloneExecutionSegment[];
  };
  characterMentions: MentionOption[];
  productMentions: MentionOption[];
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

export default function CloneMergedVideoReviewStep({
  execution,
  characterMentions,
  productMentions
}: CloneMergedVideoReviewStepProps) {
  const segments = execution.segments || [];
  const isCompleted = execution.phase === 'completed' && Boolean(execution.mergedVideoUrl);
  const [openShots, setOpenShots] = useState<Record<string, boolean>>({});
  const prefersReducedMotion = useReducedMotion();

  const toggleShot = (segmentIndex: number, shotIndex: number) => {
    const shotKey = `${segmentIndex}-${shotIndex}`;
    setOpenShots((prev) => ({
      ...prev,
      [shotKey]: !(prev[shotKey] ?? shotIndex === 0)
    }));
  };

  return (
    <div className={`${promptUi.frame} max-w-full`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Step 5</p>
          <p className="text-sm font-semibold text-[#2a2a28] inline-flex items-center gap-1.5">
            <Clapperboard className="h-4 w-4" />
            Final Video Merge Review
          </p>
          <p className="text-xs text-[#787876] mt-1">
            {isCompleted
              ? 'Final merged video is ready. Download is available in My Ads.'
              : 'Merging scene videos. You can review all scene prompts on the right.'}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs text-[#666665]">
          {isCompleted ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[#1f7a3b]" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          <span>{isCompleted ? 'Ready' : 'Merging'}</span>
        </div>
      </div>

      <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)] lg:h-[clamp(560px,74vh,920px)]">
        <div className="flex min-h-[420px] flex-col gap-1 lg:min-h-0 lg:h-full">
          <PromptFieldLabel icon={Clapperboard}>Merged Video</PromptFieldLabel>
          <div className="w-full h-full min-h-[360px] overflow-hidden rounded-2xl border border-[#e6e6e4] bg-[#f3f3f2] lg:min-h-0">
            {execution.mergedVideoUrl ? (
              <video
                src={execution.mergedVideoUrl}
                controls
                className="h-full w-full bg-black object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center text-[#8d8d8a]">
                <Loader2 className="h-5 w-5 animate-spin mb-2" />
                <p className="text-sm font-medium text-[#5d5d5a]">Merging final video...</p>
                <p className="mt-1 text-xs">The merged preview will appear here automatically.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-[420px] flex-col gap-2 lg:min-h-0 lg:h-full">
          <PromptShotLabel>All Scene Prompts (Image + Video)</PromptShotLabel>
          <div className="max-h-[620px] overflow-y-auto pr-1 space-y-3 lg:max-h-none lg:min-h-0 lg:flex-1">
            {segments.map((segment) => {
              const prompt = normalizePrompt(segment);
              return (
                <div key={segment.segmentIndex} className={`${promptUi.sectionCard} p-3 space-y-2`}>
                  <div className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#454543]" />
                    <span className="text-sm font-semibold text-[#1f1f1e]">Scene {segment.segmentIndex + 1}</span>
                  </div>

                  <div>
                    <PromptFieldLabel icon={ImageIcon}>Image Prompt</PromptFieldLabel>
                    <PromptMentionTextarea
                      value={prompt.first_frame_description}
                      onChange={() => undefined}
                      readOnly
                      rows={3}
                      className={promptUi.fieldInput}
                      characterMentions={characterMentions}
                      productMentions={productMentions}
                    />
                  </div>

                  <PromptShotLabel>Video Prompt (Shot Fields)</PromptShotLabel>
                  <div className="space-y-2">
                    {prompt.shots.map((shot, shotIndex) => {
                      const shotKey = `${segment.segmentIndex}-${shotIndex}`;
                      const shotExpanded = openShots[shotKey] ?? shotIndex === 0;

                      return (
                        <div key={`${segment.segmentIndex}-${shot.id}-${shotIndex}`} className={promptUi.shotCard}>
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
                                <div className="mt-2 grid gap-2 md:grid-cols-2">
                                  {CLONE_PROMPT_SHOT_FIELDS.map((field) => (
                                    <div key={`${segment.segmentIndex}-${shot.id}-${field.key}`}>
                                      <PromptFieldLabel icon={field.icon}>{field.label}</PromptFieldLabel>
                                      <PromptMentionTextarea
                                        value={String(shot[field.key] ?? '')}
                                        onChange={() => undefined}
                                        readOnly
                                        rows={2}
                                        className={promptUi.fieldInput}
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
