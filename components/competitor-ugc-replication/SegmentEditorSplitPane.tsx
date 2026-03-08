'use client';

import { useState, useEffect, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Boxes, GripVertical } from 'lucide-react';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import type { SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';
import type { LanguageCode } from '@/components/ui/LanguageSelector';
import SegmentListColumn from './SegmentListColumn';
import SegmentPreviewColumn from './SegmentPreviewColumn';
import SegmentFormColumn, { type SegmentPromptPayload } from './SegmentFormColumn';

interface SegmentEditorSplitPaneProps {
  projectId: string;
  segments: SegmentCardSummary[];
  segmentPlan?: { segments?: SegmentPrompt[] } | Record<string, unknown> | null;
  videoModel?: string;
  videoDuration?: string | null;
  videoAspectRatio?: '16:9' | '9:16' | string | null;
  selectedLanguage?: LanguageCode;
  onRegenerate?: (options: {
    segmentIndex: number;
    type: 'photo' | 'video';
    prompt: SegmentPromptPayload;
    productIds?: string[];
    characterIds?: string[];
  }) => Promise<void> | void;
  onMerge?: () => void;
  onDownload?: () => void;
  isMerging?: boolean;
  isDownloading?: boolean;
  readOnly?: boolean;
}

export default function SegmentEditorSplitPane({
  projectId,
  segments,
  segmentPlan,
  videoModel,
  videoDuration,
  videoAspectRatio,
  selectedLanguage,
  onRegenerate,
  onMerge,
  onDownload,
  isMerging,
  isDownloading,
  readOnly = false
}: SegmentEditorSplitPaneProps) {
  const [selectedSegmentIndex, setSelectedSegmentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  // Track submitting state per segment for instant feedback
  const [submittingSegments, setSubmittingSegments] = useState<Record<number, { photo: boolean; video: boolean }>>({});

  // Detect mobile/tablet viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Get segment plan array
  const segmentPlanArray = useMemo(() => {
    return Array.isArray(segmentPlan?.segments) ? segmentPlan.segments : [];
  }, [segmentPlan]);

  // Get selected segment data
  const selectedSegment = useMemo(() => {
    return segments[selectedSegmentIndex] || segments[0] || null;
  }, [segments, selectedSegmentIndex]);

  const selectedSegmentPlan = useMemo(() => {
    return segmentPlanArray[selectedSegmentIndex] || undefined;
  }, [segmentPlanArray, selectedSegmentIndex]);

  // Handle segment selection with boundary checking
  const handleSegmentSelect = (index: number) => {
    if (index >= 0 && index < segments.length) {
      setSelectedSegmentIndex(index);
    }
  };

  // Reset selection when segments change
  useEffect(() => {
    if (selectedSegmentIndex >= segments.length) {
      setSelectedSegmentIndex(Math.max(0, segments.length - 1));
    }
  }, [segments.length, selectedSegmentIndex]);

  // Handle regeneration with instant UI feedback
  const handleRegenerate = async (options: {
    type: 'photo' | 'video';
    prompt: SegmentPromptPayload;
    productIds?: string[];
    characterIds?: string[];
  }) => {
    if (!onRegenerate) return;

    // ✅ Instant feedback: Set loading state BEFORE API call
    setSubmittingSegments(prev => ({
      ...prev,
      [selectedSegmentIndex]: {
        photo: prev[selectedSegmentIndex]?.photo || options.type === 'photo',
        video: prev[selectedSegmentIndex]?.video || options.type === 'video'
      }
    }));

    try {
      await onRegenerate({
        segmentIndex: selectedSegmentIndex,
        ...options
      });
    } finally {
      // Clear loading state after API call (success or error)
      setSubmittingSegments(prev => ({
        ...prev,
        [selectedSegmentIndex]: {
          photo: options.type === 'photo' ? false : (prev[selectedSegmentIndex]?.photo || false),
          video: options.type === 'video' ? false : (prev[selectedSegmentIndex]?.video || false)
        }
      }));
    }
  };

  // Empty state
  if (segments.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F7F7F7]">
        <div className="space-y-3 text-center">
          <Boxes className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="text-lg font-semibold text-black">No segments available</h3>
          <p className="max-w-sm text-sm text-[#666666]">
            Segments will appear here once frame generation begins.
          </p>
        </div>
      </div>
    );
  }

  // Mobile fallback: Show message (or could use SegmentInspector modal)
  if (isMobile) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F7F7F7] p-4">
        <div className="space-y-3 text-center">
          <Boxes className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="text-lg font-semibold text-black">Desktop View Required</h3>
          <p className="max-w-sm text-sm text-[#666666]">
            The segment editor is optimized for desktop. Please use a larger screen to edit segments.
          </p>
        </div>
      </div>
    );
  }

  // Desktop: 3-column resizable layout
  return (
    <div className="clone-editor-root h-full w-full">
      <Group orientation="horizontal" className="h-full">
        {/* Left Panel: Segment List */}
        <Panel
          id="segment-list"
          defaultSize={16}
          minSize={12}
          maxSize={22}
          className="h-full"
        >
          <SegmentListColumn
            segments={segments}
            selectedIndex={selectedSegmentIndex}
            onSelectSegment={handleSegmentSelect}
            onMerge={onMerge}
            onDownload={onDownload}
            isMerging={isMerging}
            isDownloading={isDownloading}
            readOnly={readOnly}
          />
        </Panel>

        {/* Divider 1 - Improved Hit Area */}
        <Separator className="clone-editor-separator group relative z-10 w-2 cursor-col-resize bg-transparent outline-none flex justify-center items-center hover:bg-gray-50 transition-colors">
          <div className="clone-editor-separator-line h-full w-[1px] bg-[#E5E5E5] group-hover:bg-black group-active:bg-black transition-colors" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-8 w-4 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="h-4 w-4 text-black" />
            </div>
          </div>
        </Separator>

        {/* Middle Panel: Preview */}
        <Panel
          id="preview"
          defaultSize={44}
          minSize={34}
          maxSize={56}
          className="h-full"
        >
          {selectedSegment && (
            <SegmentPreviewColumn
              segment={selectedSegment}
              videoAspectRatio={videoAspectRatio}
              videoModel={videoModel}
            />
          )}
        </Panel>

        {/* Divider 2 - Improved Hit Area */}
        <Separator className="clone-editor-separator group relative z-10 w-2 cursor-col-resize bg-transparent outline-none flex justify-center items-center hover:bg-gray-50 transition-colors">
          <div className="clone-editor-separator-line h-full w-[1px] bg-[#E5E5E5] group-hover:bg-black group-active:bg-black transition-colors" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="h-8 w-4 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="h-4 w-4 text-black" />
            </div>
          </div>
        </Separator>

        {/* Right Panel: Form */}
        <Panel
          id="form"
          defaultSize={40}
          minSize={28}
          maxSize={50}
          className="h-full"
        >
          {selectedSegment && (
            <SegmentFormColumn
              projectId={projectId}
              segmentIndex={selectedSegmentIndex}
              segment={selectedSegment}
              segmentPlanEntry={selectedSegmentPlan}
              videoModel={videoModel}
              videoDuration={videoDuration}
              selectedLanguage={selectedLanguage}
              onRegenerate={handleRegenerate}
              isSubmitting={submittingSegments[selectedSegmentIndex] || { photo: false, video: false }}
              readOnly={readOnly}
            />
          )}
        </Panel>
      </Group>
    </div>
  );
}
