'use client';

import { useState, useEffect, useMemo } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { Boxes } from 'lucide-react';
import type { SegmentCardSummary } from '@/components/ui/GenerationProgressDisplay';
import type { SegmentPrompt } from '@/lib/competitor-ugc-replication-workflow';
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
  brandId?: string | null;
  brandName?: string | null;
  onRegenerate?: (options: {
    segmentIndex: number;
    type: 'photo' | 'video';
    prompt: SegmentPromptPayload;
    productIds?: string[];
    characterIds?: string[];
  }) => Promise<void> | void;
  onMerge?: () => void;
  isMerging?: boolean;
  readOnly?: boolean;
}

export default function SegmentEditorSplitPane({
  projectId,
  segments,
  segmentPlan,
  videoModel,
  videoDuration,
  videoAspectRatio,
  brandId,
  brandName,
  onRegenerate,
  onMerge,
  isMerging,
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
    <div className="h-full w-full">
      <Group orientation="horizontal" className="h-full">
        {/* Left Panel: Segment List */}
        <Panel
          id="segment-list"
          defaultSize={20}
          minSize={15}
          maxSize={30}
          className="h-full"
        >
          <SegmentListColumn
            segments={segments}
            selectedIndex={selectedSegmentIndex}
            onSelectSegment={handleSegmentSelect}
            onMerge={onMerge}
            isMerging={isMerging}
            readOnly={readOnly}
          />
        </Panel>

        {/* Divider 1 */}
        <Separator className="group relative w-[1px] bg-[#E5E5E5] transition-colors hover:bg-black">
          <div className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </Separator>

        {/* Middle Panel: Preview */}
        <Panel
          id="preview"
          defaultSize={35}
          minSize={25}
          maxSize={50}
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

        {/* Divider 2 */}
        <Separator className="group relative w-[1px] bg-[#E5E5E5] transition-colors hover:bg-black">
          <div className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </Separator>

        {/* Right Panel: Form */}
        <Panel
          id="form"
          defaultSize={45}
          minSize={30}
          maxSize={60}
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
              brandId={brandId}
              brandName={brandName}
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
