# Segment Breakdown Editor Integration Guide

## Overview
This guide shows how to integrate the new `SegmentBreakdownEditor` component into `GenerationProgressDisplay.tsx` to replace the expanded segment list with a button + modal interface.

## Step 1: Import the Component

Add this import near the top of `/components/ui/GenerationProgressDisplay.tsx` (after line 35):

```typescript
import SegmentBreakdownEditor from '@/components/competitor-ugc-replication/SegmentBreakdownEditor';
```

## Step 2: Replace the Segment Toggle Section

Find the section around **line 579-618** that contains:

```tsx
{/* Segments Toggle */}
{hasSegments && (
  <div className="mt-4">
    <button onClick={() => onToggleSegments?.(generation)} ...>
      ...
    </button>
    <AnimatePresence>
      {isExpanded && (
        <motion.div ...>
          <SegmentBoard ... />
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)}
```

**Replace it with:**

```tsx
{/* Segment Breakdown Editor */}
{hasSegments && generation.segments && generation.segments.length > 0 && (
  <div className="mt-4">
    <SegmentBreakdownEditor
      projectId={(generation as any).projectId || generation.id}
      segments={generation.segments}
      segmentPlan={generation.segmentPlan}
      videoModel={generation.videoModel}
      videoDuration={generation.videoDuration}
      videoAspectRatio={generation.videoAspectRatio}
      brandId={generation.brandId}
      brandName={generation.brand}
      onSegmentClick={(segmentIndex) => {
        const segment = generation.segments?.[segmentIndex];
        if (segment && onSegmentSelect) {
          onSegmentSelect(generation, segment);
        }
      }}
    />
  </div>
)}
```

## Step 3: Remove Unused Props (Optional Cleanup)

After the integration, you can optionally remove these props from `GenerationProgressDisplayProps` (around line 116):

- `expandedGenerationId?: string | null;`
- `onToggleSegments?: (generation: Generation) => void;`

And from the `GenerationCard` function signature (around line 234).

## Step 4: Remove SegmentBoard Component (Optional Cleanup)

You can delete the `SegmentBoard` and `SegmentSummaryCard` functions (around lines 649-750) since they're no longer used.

## What Changes

### Before:
- Click button → Expands inline → Shows all segments in a grid
- Each segment is a card with preview images
- Animations slide down/up

### After:
- Click "View Segment Breakdown" button → Opens modal dialog
- Clean, scrollable list of all segments
- Click any segment → Opens detailed segment inspector
- Modal closes automatically after selecting a segment

## Design Benefits

1. **Cleaner UI**: No expanding/collapsing sections cluttering the main view
2. **Better Mobile**: Modal provides full-screen experience on mobile
3. **Faster Navigation**: See all segments at once in a dedicated space
4. **Consistent Design**: Follows the black/white/gray minimalist theme exactly
5. **Better UX**: Dedicated space for segment management vs. inline expansion

## Testing

1. Generate a competitor UGC replication video
2. After generation completes, look for the "View Segment Breakdown" button
3. Click it to open the modal
4. Click any segment to inspect/edit it
5. Verify the segment inspector opens correctly

## Rollback

If you need to revert, simply:
1. Remove the import for `SegmentBreakdownEditor`
2. Restore the original segment toggle button code
3. The old code is preserved in git history
