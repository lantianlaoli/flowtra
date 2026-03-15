'use client';

import type { ReactNode } from 'react';
import NextImage from 'next/image';
import clsx from 'clsx';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Eye, Image as ImageIcon, Loader2, Video as VideoIcon } from 'lucide-react';

interface MotionSwapEditorSplitPaneProps {
  firstFrameUrl?: string | null;
  originalVideoUrl?: string | null;
  generatedVideoUrl?: string | null;
  videoAspectRatio?: '16:9' | '9:16' | string | null;
  isGeneratingImage?: boolean;
  isGeneratingVideo?: boolean;
  form: ReactNode;
}

function getAspectRatioClass(ratio?: string | null) {
  switch (ratio) {
    case '9:16':
      return 'aspect-[9/16]';
    case '1:1':
      return 'aspect-square';
    case '16:9':
    default:
      return 'aspect-[16/9]';
  }
}

function PreviewCard({
  title,
  icon,
  className,
  children,
}: {
  title: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx('flex min-w-0 flex-col', className)}>
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-[#666666]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function MotionSwapEditorSplitPane({
  firstFrameUrl,
  originalVideoUrl,
  generatedVideoUrl,
  videoAspectRatio,
  isGeneratingImage = false,
  isGeneratingVideo = false,
  form,
}: MotionSwapEditorSplitPaneProps) {
  const previewAspectClass = getAspectRatioClass(videoAspectRatio);
  const mediaClass = clsx(
    'relative w-full overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#F7F7F7]',
    previewAspectClass,
  );

  return (
    <div className="motion-swap-editor-split h-full w-full">
      <Group orientation="horizontal" className="h-full">
        <Panel id="preview" defaultSize={59} minSize={50} maxSize={74} className="h-full">
          <div className="flex h-full flex-col bg-white">
            <div className="flex-shrink-0 border-b border-[#E5E5E5] bg-gray-50 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-black" />
                <h2 className="text-sm font-semibold text-black">Preview</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5">
              <div className="grid grid-cols-3 items-start gap-2.5">
                <PreviewCard
                  title="First Frame"
                  icon={<ImageIcon className="h-3.5 w-3.5" />}
                >
                  <div className={mediaClass}>
                    {isGeneratingImage ? (
                      <div className="relative flex h-full w-full overflow-hidden bg-[#f3f3f3]">
                        <div className="motion-swap-wave absolute inset-0 opacity-90" />
                        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center text-center text-sm text-[#666666]">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
                          <span className="mt-2 font-medium text-[#444444]">
                            Generating image...
                          </span>
                          <span className="mt-1 text-xs text-[#777777]">
                            Usually takes around 10-20 seconds.
                          </span>
                        </div>
                      </div>
                    ) : firstFrameUrl ? (
                      <NextImage
                        src={firstFrameUrl}
                        alt="Generated first frame"
                        className="h-full w-full object-contain"
                        fill
                        sizes="(max-width: 1400px) 30vw, 26vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[#666666]">
                        Image preview not generated yet.
                      </div>
                    )}
                  </div>
                </PreviewCard>

                <PreviewCard
                  title="Original Video"
                  icon={<VideoIcon className="h-3.5 w-3.5" />}
                >
                  <div className={mediaClass}>
                    {originalVideoUrl ? (
                      <video
                        key={originalVideoUrl}
                        src={originalVideoUrl}
                        controls
                        controlsList="nodownload"
                        playsInline
                        muted
                        preload="metadata"
                        className="h-full w-full rounded-lg bg-black object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[#666666]">
                        Original video not available.
                      </div>
                    )}
                  </div>
                </PreviewCard>

                <PreviewCard
                  title="Generated Video"
                  icon={<VideoIcon className="h-3.5 w-3.5" />}
                >
                  <div className={mediaClass}>
                    {isGeneratingVideo ? (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-gray-100 via-gray-200 to-gray-100 text-sm text-[#666666]">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
                        <span className="mt-2">Rendering video...</span>
                      </div>
                    ) : generatedVideoUrl ? (
                      <video
                        key={generatedVideoUrl}
                        src={generatedVideoUrl}
                        controls
                        controlsList="nodownload"
                        playsInline
                        preload="metadata"
                        className="h-full w-full rounded-lg bg-black object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[#666666]">
                        Generated video not available yet.
                      </div>
                    )}
                  </div>
                </PreviewCard>
              </div>
            </div>
          </div>
        </Panel>

        <Separator className="group relative z-10 flex w-2 cursor-col-resize items-center justify-center bg-transparent outline-none transition-colors hover:bg-gray-50">
          <div className="h-full w-[1px] bg-[#E5E5E5] transition-colors group-hover:bg-black group-active:bg-black" />
        </Separator>

        <Panel id="form" defaultSize={40} minSize={26} maxSize={52} className="h-full">
          {form}
        </Panel>
      </Group>

      <style jsx>{`
        .motion-swap-wave {
          background:
            linear-gradient(
              115deg,
              rgba(255, 255, 255, 0) 20%,
              rgba(255, 255, 255, 0.75) 36%,
              rgba(255, 255, 255, 0.12) 52%,
              rgba(255, 255, 255, 0) 68%
            ),
            linear-gradient(180deg, #efefef 0%, #e7e7e7 52%, #f4f4f4 100%);
          background-size: 220% 100%, 100% 100%;
          animation: motionSwapWaveSweep 1.7s linear infinite;
        }

        @keyframes motionSwapWaveSweep {
          0% {
            background-position: 140% 0, 0 0;
          }
          100% {
            background-position: -40% 0, 0 0;
          }
        }
      `}</style>
    </div>
  );
}
