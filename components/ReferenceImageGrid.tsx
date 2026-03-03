'use client';

import Image from 'next/image';
import { Loader2, Plus, Upload, X } from 'lucide-react';

interface ReferenceImageGridItem {
  alt: string;
  key: string;
  src: string;
}

interface ReferenceImageGridSlot {
  description: string;
  label: string;
}

interface ReferenceImageGridProps {
  items: ReferenceImageGridItem[];
  isGenerating: boolean;
  onAdd?: () => void;
  onRemove: (index: number) => void;
  removeDisabled?: boolean;
  slots?: ReferenceImageGridSlot[];
}

const MAX_REFERENCE_IMAGES = 3;
const GRID_CARD_COUNT = 4;

export const PRODUCT_REFERENCE_SLOTS: ReferenceImageGridSlot[] = [
  {
    label: '45° Front Left',
    description: 'Show the left-front plane and product depth.'
  },
  {
    label: '45° Front Right',
    description: 'Show the right-front plane and structure balance.'
  },
  {
    label: 'Back View',
    description: 'Reveal the rear label, packaging details, or instructions.'
  }
];

function SlotBadge({
  label
}: {
  label: string;
}) {
  return (
    <div
      className="inline-flex items-center rounded-md border border-black/10 bg-white/92 px-2 py-1 text-[10px] font-medium text-gray-800 backdrop-blur-sm"
    >
      {label}
    </div>
  );
}

function ReferenceImageCard({
  alt,
  label,
  onRemove,
  removeDisabled,
  src
}: {
  alt: string;
  label: string;
  onRemove: () => void;
  removeDisabled?: boolean;
  src: string;
}) {
  return (
    <div className="group relative aspect-[4/5] overflow-hidden rounded-[18px] border border-black/8 bg-white">
      <div className="absolute left-2 top-2 z-10">
        <SlotBadge label={label} />
      </div>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-contain p-2.5 transition-transform duration-300 group-hover:scale-[1.01]"
        sizes="(max-width: 1024px) 28vw, 180px"
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-full bg-black/65 p-1.5 text-white transition hover:bg-black"
        disabled={removeDisabled}
        aria-label={`Remove ${alt}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function ReferenceImageLoadingCard({
  label
}: {
  label: string;
}) {
  return (
    <div
      className="relative aspect-[4/5] overflow-hidden rounded-[18px] border border-black/8 bg-[linear-gradient(180deg,#fafafa_0%,#f1f1f1_55%,#fafafa_100%)]"
      aria-busy="true"
    >
      <div className="absolute left-2 top-2 z-10">
        <SlotBadge label={label} />
      </div>
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),transparent_46%)]" />
      <div className="relative flex h-full items-center justify-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/88 text-gray-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </div>
    </div>
  );
}

function ReferenceImageAddCard({
  label,
  onAdd
}: {
  label: string;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="relative flex aspect-[4/5] flex-col items-center justify-center rounded-[18px] border border-dashed border-black/10 bg-white text-gray-500 transition hover:bg-[#fafafa] hover:text-gray-700"
    >
      <div className="absolute left-2 top-2">
        <SlotBadge label={label} />
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/88 shadow-sm">
        <Upload className="h-4 w-4" />
      </div>
    </button>
  );
}

function ReferenceImageEmptyCard({
  label
}: {
  label: string;
}) {
  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] border border-dashed border-black/8 bg-white">
      <div className="absolute left-2 top-2 z-10">
        <SlotBadge label={label} />
      </div>
      <div className="flex h-full items-center justify-center text-gray-300">
        <Plus className="h-5 w-5" />
      </div>
    </div>
  );
}

function ReferenceImageHelperCard({
  canAdd,
  filledCount,
  isGenerating,
  onAdd
}: {
  canAdd: boolean;
  filledCount: number;
  isGenerating: boolean;
  onAdd?: () => void;
}) {
  if (isGenerating) {
    return (
      <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-black/8 bg-white">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/88 text-gray-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      </div>
    );
  }

  if (canAdd && onAdd) {
    return (
      <button
        type="button"
        onClick={onAdd}
        className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-black/10 bg-white text-gray-500 transition hover:bg-[#fafafa] hover:text-gray-700"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/88 shadow-sm">
          <Upload className="h-4 w-4" />
        </div>
      </button>
    );
  }

  return (
    <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-black/8 bg-white">
      <div className="h-1.5 w-1.5 rounded-full bg-black/10" />
    </div>
  );
}

export default function ReferenceImageGrid({
  items,
  isGenerating,
  onAdd,
  onRemove,
  removeDisabled = false,
  slots = PRODUCT_REFERENCE_SLOTS
}: ReferenceImageGridProps) {
  const pendingCount = isGenerating ? Math.max(0, MAX_REFERENCE_IMAGES - items.length) : 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: GRID_CARD_COUNT }, (_, index) => {
        if (index === GRID_CARD_COUNT - 1) {
          return (
            <ReferenceImageHelperCard
              key="helper-card"
              canAdd={Boolean(onAdd) && items.length < MAX_REFERENCE_IMAGES}
              filledCount={items.length}
              isGenerating={isGenerating}
              onAdd={onAdd}
            />
          );
        }

        const item = items[index];
        const slot = slots[index] || PRODUCT_REFERENCE_SLOTS[index];

        if (item) {
          return (
            <ReferenceImageCard
              key={item.key}
              alt={item.alt}
              label={slot.label}
              onRemove={() => onRemove(index)}
              removeDisabled={removeDisabled}
              src={item.src}
            />
          );
        }

        if (index < items.length + pendingCount) {
          return (
            <ReferenceImageLoadingCard
              key={`loading-${index}`}
              label={slot.label}
            />
          );
        }

        if (onAdd && index === items.length) {
          return (
            <ReferenceImageAddCard
              key="add-reference"
              label={slot.label}
              onAdd={onAdd}
            />
          );
        }

        return (
          <ReferenceImageEmptyCard
            key={`empty-${index}`}
            label={slot.label}
          />
        );
      })}
    </div>
  );
}
