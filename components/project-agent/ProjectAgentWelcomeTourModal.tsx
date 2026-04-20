'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, Check, Lightbulb, MessageSquare, MousePointer2, Play, Sparkles, X } from 'lucide-react';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

export const PROJECT_AGENT_WELCOME_TOUR_STORAGE_KEY = 'flowtra_project_agent_tour_dismissed_v1';

const SITE_ASSET_VIDEO_BASE_URL =
  'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos';

type ProjectAgentWelcomeTourModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TourStep = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: typeof Play;
};

const tourSteps: TourStep[] = [
  {
    id: 'walkthrough',
    title: 'Watch the full walkthrough',
    eyebrow: 'Start here',
    description: 'Get the complete overview of the AI Agent canvas, from adding assets to generating final videos.',
    icon: Play,
  },
  {
    id: 'reference-result',
    title: 'See reference to result',
    eyebrow: 'What it creates',
    description: 'Compare a reference video with the generated result so you understand what the agent is optimizing for.',
    icon: Sparkles,
  },
  {
    id: 'manual-select',
    title: 'Add assets and feature nodes',
    eyebrow: 'Build the canvas',
    description: 'Use the bottom toolbar to add avatars, products, videos, text, and generation feature nodes.',
    icon: MousePointer2,
  },
  {
    id: 'chat-edit',
    title: 'Edit with chat',
    eyebrow: 'Work faster',
    description: 'Tell Flowgen what you want changed and let the chat update your canvas workflow for you.',
    icon: MessageSquare,
  },
];

export function isProjectAgentWelcomeTourDismissed() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(PROJECT_AGENT_WELCOME_TOUR_STORAGE_KEY) === 'true';
}

export function ProjectAgentWelcomeTourModal({ open, onOpenChange }: ProjectAgentWelcomeTourModalProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const activeStep = tourSteps[activeStepIndex];
  const isFirstStep = activeStepIndex === 0;
  const isLastStep = activeStepIndex === tourSteps.length - 1;
  const isReferenceResultStep = activeStep.id === 'reference-result';

  useEffect(() => {
    if (!open) return;
    setActiveStepIndex(0);
    setDontShowAgain(false);
  }, [open]);

  const persistDismissalIfNeeded = () => {
    if (dontShowAgain && typeof window !== 'undefined') {
      window.localStorage.setItem(PROJECT_AGENT_WELCOME_TOUR_STORAGE_KEY, 'true');
    }
  };

  const closeTour = () => {
    persistDismissalIfNeeded();
    onOpenChange(false);
  };

  const renderStepMedia = () => {
    if (activeStep.id === 'walkthrough') {
      return (
        <div className="project-agent-tour-video-shell aspect-video bg-black">
          <iframe
            className="h-full w-full"
            src="https://www.youtube.com/embed/11CrLHYJ6sA?rel=0"
            title="Flowtra AI Agent tutorial walkthrough"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      );
    }

    if (activeStep.id === 'reference-result') {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="project-agent-tour-media-label">Reference video</p>
            <div className="project-agent-tour-video-shell aspect-[9/16]">
              <LazyVideoPlayer
                src={`${SITE_ASSET_VIDEO_BASE_URL}/agent_refer_1.mp4`}
                wrapperClassName="h-full w-full"
                className="h-full w-full object-cover"
                ariaLabel="Reference video example for AI Agent"
                showControls={false}
                playsInline
                loop
                autoPlay
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="project-agent-tour-media-label project-agent-tour-media-label--strong">Generated result</p>
            <div className="project-agent-tour-video-shell project-agent-tour-video-shell--accent aspect-[9/16]">
              <LazyVideoPlayer
                src={`${SITE_ASSET_VIDEO_BASE_URL}/agent_result_1.mp4`}
                wrapperClassName="h-full w-full"
                className="h-full w-full object-cover"
                ariaLabel="Generated result video example for AI Agent"
                showControls={false}
                playsInline
                loop
                autoPlay
              />
            </div>
          </div>
        </div>
      );
    }

    const src = activeStep.id === 'manual-select'
      ? `${SITE_ASSET_VIDEO_BASE_URL}/agent_manual_select.mp4`
      : `${SITE_ASSET_VIDEO_BASE_URL}/agent_chat.mp4`;

    return (
      <div className="project-agent-tour-video-shell aspect-video bg-[#f4f4f2]">
        <LazyVideoPlayer
          src={src}
          wrapperClassName="h-full w-full"
          className="h-full w-full object-cover"
          ariaLabel={`${activeStep.title} demo video`}
          showControls={false}
          playsInline
          loop
          autoPlay
        />
      </div>
    );
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }
        closeTour();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="project-agent-tour-overlay fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="project-agent-tour-content fixed left-1/2 top-1/2 z-[130] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1320px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-[#d9d9d4] bg-[#f7f6f1] shadow-[0_34px_100px_rgba(0,0,0,0.28)] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="project-agent-tour-header flex items-start justify-between gap-4 border-b border-[#dfded8] px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#77736a]">AI Agent tutorial</p>
              <Dialog.Title className="mt-1 text-[24px] font-semibold tracking-[-0.03em] text-[#161616] sm:text-[30px]">
                Build your first AI video workflow
              </Dialog.Title>
              <Dialog.Description className="mt-1 max-w-[640px] text-sm leading-6 text-[#68645c]">
                Learn the core canvas steps in a few minutes, then start creating with your own assets.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="project-agent-tour-icon-button inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d7d5ce] bg-white text-[#45423b] transition-colors hover:bg-[#eeeeea] focus:outline-none focus:ring-2 focus:ring-black/20"
                aria-label="Close AI Agent tutorial"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="grid min-h-0 overflow-y-auto lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="project-agent-tour-steps border-b border-[#dfded8] p-4 lg:border-b-0 lg:border-r lg:p-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {tourSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === activeStepIndex;
                  const isComplete = index < activeStepIndex;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setActiveStepIndex(index)}
                      className={`project-agent-tour-step flex min-h-[86px] w-full items-start gap-3 rounded-[18px] border p-3 text-left transition-all ${
                        isActive
                          ? 'project-agent-tour-step--active border-[#111111] bg-white text-[#171717] shadow-[0_14px_30px_rgba(0,0,0,0.08)]'
                          : 'border-transparent bg-transparent text-[#646057] hover:border-[#dfded8] hover:bg-white/60'
                      }`}
                      aria-current={isActive ? 'step' : undefined}
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border ${
                        isActive
                          ? 'border-[#111111] bg-[#111111] text-white'
                          : isComplete
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-[#d9d7cf] bg-white text-[#77736a]'
                      }`}>
                        {isComplete ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-inherit opacity-70">
                          {step.eyebrow}
                        </span>
                        <span className="mt-1 block text-sm font-semibold leading-5">{step.title}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="project-agent-tour-main min-h-0 p-4 sm:p-5 lg:p-6">
              <div className={`grid gap-5 ${isReferenceResultStep ? 'xl:grid-cols-[minmax(0,1fr)_250px]' : 'xl:grid-cols-[minmax(0,1fr)_300px]'}`}>
                <div className="min-w-0">{renderStepMedia()}</div>
                <div className="project-agent-tour-copy rounded-[22px] border border-[#dedbd2] bg-white/78 p-5">
                  <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#77736a]">
                    Step {activeStepIndex + 1} of {tourSteps.length}
                  </p>
                  <h3 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-[#171717]">
                    {activeStep.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-[#625f57]">{activeStep.description}</p>
                  </div>
                  <div className="project-agent-tour-tip mt-5 flex items-start gap-3 text-sm leading-6 text-[#4f4b43]">
                    <Lightbulb className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#8a7f67]" />
                    <p>
                      {activeStep.id === 'walkthrough'
                        ? 'Watch this first if you want the fastest mental model for the canvas.'
                        : activeStep.id === 'reference-result'
                          ? 'Use reference videos when you want the agent to match a proven ad structure.'
                          : activeStep.id === 'manual-select'
                            ? 'Drag assets and feature nodes onto the canvas, then connect compatible handles.'
                            : 'Ask the chat to organize the canvas, select assets, or prepare generation steps.'}
                    </p>
                  </div>
                </div>
              </div>
            </main>
          </div>

          <div className="project-agent-tour-footer flex flex-col gap-3 border-t border-[#dfded8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <label className="project-agent-tour-checkbox flex min-h-10 cursor-pointer items-center gap-3 text-sm font-medium text-[#4f4b43]">
              <span className={`flex h-5 w-5 items-center justify-center rounded-[6px] border transition-colors ${
                dontShowAgain ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#bdb9ae] bg-white text-transparent'
              }`}>
                <Check className="h-3.5 w-3.5" />
              </span>
              <input
                checked={dontShowAgain}
                className="sr-only"
                onChange={(event) => setDontShowAgain(event.target.checked)}
                type="checkbox"
              />
              Don&apos;t show this again
            </label>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={closeTour}
                className="project-agent-tour-secondary-button inline-flex h-11 items-center justify-center rounded-[14px] border border-[#d2d0c8] bg-white px-4 text-sm font-semibold text-[#302d27] transition-colors hover:bg-[#eeeeea] focus:outline-none focus:ring-2 focus:ring-black/20"
              >
                Skip
              </button>
              <button
                type="button"
                disabled={isFirstStep}
                onClick={() => setActiveStepIndex((current) => Math.max(0, current - 1))}
                className="project-agent-tour-secondary-button inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#d2d0c8] bg-white px-4 text-sm font-semibold text-[#302d27] transition-colors hover:bg-[#eeeeea] focus:outline-none focus:ring-2 focus:ring-black/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              {isLastStep ? (
                <button
                  type="button"
                  onClick={closeTour}
                  className="project-agent-tour-primary-button inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#111111] bg-[#111111] px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(0,0,0,0.18)] transition-colors hover:bg-[#272727] focus:outline-none focus:ring-2 focus:ring-black/20"
                >
                  Start creating
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveStepIndex((current) => Math.min(tourSteps.length - 1, current + 1))}
                  className="project-agent-tour-primary-button inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#111111] bg-[#111111] px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(0,0,0,0.18)] transition-colors hover:bg-[#272727] focus:outline-none focus:ring-2 focus:ring-black/20"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
