'use client';

import type { ReactNode } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import SegmentPreviewColumn from '@/components/competitor-ugc-replication/SegmentPreviewColumn';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';

interface MotionSwapEditorSplitPaneProps {
  segment: SegmentCardSummary;
  videoAspectRatio?: '16:9' | '9:16' | string | null;
  videoModel?: string;
  form: ReactNode;
}

export default function MotionSwapEditorSplitPane({
  segment,
  videoAspectRatio,
  videoModel,
  form
}: MotionSwapEditorSplitPaneProps) {
  return (
    <div className="motion-swap-editor-split h-full w-full">
      <Group orientation="horizontal" className="h-full">
        <Panel id="preview" defaultSize={52} minSize={40} maxSize={70} className="h-full">
          <SegmentPreviewColumn
            segment={segment}
            videoAspectRatio={videoAspectRatio}
            videoModel={videoModel}
            layout="split"
            videoEtaLabel="Video rendering can take 5-10 minutes depending on length."
          />
        </Panel>

        <Separator className="motion-swap-editor-separator group relative z-10 w-2 cursor-col-resize bg-transparent outline-none flex justify-center items-center hover:bg-gray-50 transition-colors">
          <div className="motion-swap-editor-separator-line h-full w-[1px] bg-[#E5E5E5] group-hover:bg-black group-active:bg-black transition-colors" />
        </Separator>

        <Panel id="form" defaultSize={48} minSize={30} maxSize={60} className="h-full">
          {form}
        </Panel>
      </Group>
    </div>
  );
}
