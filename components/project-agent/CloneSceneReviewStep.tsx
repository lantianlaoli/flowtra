'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clapperboard,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Play
} from 'lucide-react';
import PromptMentionTextarea from '@/components/ui/PromptMentionTextarea';

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
  firstFrameUrl?: string | null;
  videoUrl?: string | null;
  errorMessage?: string | null;
  prompt?: CloneExecutionSegmentPrompt;
};

const SHOT_FIELDS: Array<{
  key: keyof CloneExecutionSegmentPrompt['shots'][number];
  label: string;
}> = [
  { key: 'subject', label: 'Subject' },
  { key: 'context_environment', label: 'Context & Environment' },
  { key: 'action', label: 'Action' },
  { key: 'style', label: 'Style' },
  { key: 'camera_motion_positioning', label: 'Camera Motion & Positioning' },
  { key: 'composition', label: 'Composition' },
  { key: 'ambiance_colour_lighting', label: 'Ambiance / Colour / Lighting' },
  { key: 'audio', label: 'Audio' },
  { key: 'dialogue', label: 'Dialogue' }
];

type CloneSceneReviewStepProps = {
  execution: {
    projectId: string;
    phase: 'idle' | 'generating_frames' | 'reviewing_frames' | 'generating_videos' | 'merging' | 'completed' | 'failed';
    segments?: CloneExecutionSegment[];
  };
  characterMentions: MentionOption[];
  productMentions: MentionOption[];
  onRegenerateFrame: (segmentIndex: number, prompt: CloneExecutionSegmentPrompt) => Promise<void> | void;
  onGenerateFinalVideo: () => Promise<void> | void;
  canGenerateFinalVideo: boolean;
  isGeneratingFinalVideo: boolean;
  regeneratingSegmentIndex: number | null;
};

const statusLabel = (status: string) => {
  if (status === 'first_frame_ready') return 'Ready';
  if (status === 'generating_first_frame') return 'Generating frame';
  if (status === 'failed') return 'Failed';
  if (status === 'video_ready') return 'Video ready';
  return 'Queued';
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
  onRegenerateFrame,
  onGenerateFinalVideo,
  canGenerateFinalVideo,
  isGeneratingFinalVideo,
  regeneratingSegmentIndex
}: CloneSceneReviewStepProps) {
  const [localPrompts, setLocalPrompts] = useState<Record<number, CloneExecutionSegmentPrompt>>({});
  const segments = useMemo(() => execution.segments || [], [execution.segments]);

  useEffect(() => {
    const next: Record<number, CloneExecutionSegmentPrompt> = {};
    segments.forEach((segment) => {
      next[segment.segmentIndex] = normalizePrompt(segment);
    });
    setLocalPrompts(next);
  }, [segments]);

  const headerLabel = useMemo(() => {
    if (execution.phase === 'generating_frames') return 'Generating scene frames...';
    if (execution.phase === 'reviewing_frames') return 'Review each scene frame and regenerate if needed.';
    if (execution.phase === 'generating_videos') return 'Final videos are generating.';
    if (execution.phase === 'merging') return 'Merging segments...';
    if (execution.phase === 'completed') return 'Generation completed.';
    if (execution.phase === 'failed') return 'Generation failed.';
    return 'Preparing scenes...';
  }, [execution.phase]);

  const updatePrompt = (segmentIndex: number, updater: (current: CloneExecutionSegmentPrompt) => CloneExecutionSegmentPrompt) => {
    setLocalPrompts((prev) => ({
      ...prev,
      [segmentIndex]: updater(prev[segmentIndex] || normalizePrompt({ segmentIndex, status: 'queued' }))
    }));
  };

  return (
    <div className="w-full max-w-full lg:max-w-[64%] rounded-2xl border border-[#e6e6e4] bg-white p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8a]">Step 4</p>
          <p className="text-sm font-semibold text-[#2a2a28] inline-flex items-center gap-1.5">
            <Clapperboard className="h-4 w-4" />
            Scene First Frame Review
          </p>
          <p className="text-xs text-[#787876] mt-1">{headerLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => void onGenerateFinalVideo()}
          disabled={!canGenerateFinalVideo || isGeneratingFinalVideo}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#0f0f0f] px-3 py-2 text-xs text-white disabled:opacity-50"
        >
          {isGeneratingFinalVideo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {isGeneratingFinalVideo ? 'Starting...' : 'Generate Final Video'}
        </button>
      </div>

      <div className="space-y-3">
        {segments.map((segment) => {
          const prompt = localPrompts[segment.segmentIndex] || normalizePrompt(segment);
          return (
            <div key={segment.segmentIndex} className="rounded-xl border border-[#e6e6e4] bg-[#fcfcfb] p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#454543]" />
                  <span className="text-sm font-semibold text-[#1f1f1e]">Scene {segment.segmentIndex + 1}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#666665]">
                  {segment.status === 'first_frame_ready' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#1f7a3b]" />
                  ) : segment.status === 'failed' ? (
                    <AlertCircle className="h-3.5 w-3.5 text-[#b23b3b]" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>{statusLabel(segment.status)}</span>
                </div>
              </div>

              {segment.firstFrameUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={segment.firstFrameUrl} alt={`Scene ${segment.segmentIndex + 1} frame`} className="h-40 w-full rounded-lg border border-[#e6e6e4] object-cover" />
              ) : (
                <div className="h-40 w-full rounded-lg border border-dashed border-[#d9d9d7] bg-[#f7f7f5] flex items-center justify-center text-xs text-[#8d8d8a]">
                  <ImageIcon className="h-4 w-4 mr-1" />
                  Frame is generating...
                </div>
              )}

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6f6d]">Image Prompt</p>
                <PromptMentionTextarea
                  value={prompt.first_frame_description}
                  rows={3}
                  onChange={(next) => updatePrompt(segment.segmentIndex, (current) => ({ ...current, first_frame_description: next }))}
                  characterMentions={characterMentions}
                  productMentions={productMentions}
                />
              </div>

              {prompt.shots.map((shot, shotIndex) => (
                <div key={`${segment.segmentIndex}-${shot.id}-${shotIndex}`} className="rounded-lg border border-[#ececea] bg-white p-3 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6f6d]">Shot {shotIndex + 1}</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {SHOT_FIELDS.map((field) => (
                      <div key={`${segment.segmentIndex}-${shot.id}-${field.key}`}>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f6f6d]">
                          {field.label}
                        </p>
                        <PromptMentionTextarea
                          value={String(shot[field.key] ?? '')}
                          rows={2}
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
                </div>
              ))}

              <button
                type="button"
                onClick={() => void onRegenerateFrame(segment.segmentIndex, prompt)}
                disabled={regeneratingSegmentIndex === segment.segmentIndex}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#d9d9d7] bg-white px-3 py-2 text-xs text-[#1f1f1e] hover:bg-[#f3f3f2] disabled:opacity-50"
              >
                {regeneratingSegmentIndex === segment.segmentIndex ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {regeneratingSegmentIndex === segment.segmentIndex ? 'Regenerating...' : 'Regenerate Frame'}
              </button>

              {segment.errorMessage ? (
                <p className="text-xs text-[#b23b3b]">{segment.errorMessage}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
