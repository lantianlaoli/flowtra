'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Box, ChevronDown, Clapperboard, Package2, Sparkles, Type, User, Video } from 'lucide-react';
import {
  getProjectAgentFeatureDisplayName,
  type ProjectAgentAssetNodeType,
  type ProjectAgentCanvasAssetRef,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';

type InsertToolbarProps = {
  avatars: ProjectAgentCanvasAssetRef[];
  products: ProjectAgentCanvasAssetRef[];
  videos: ProjectAgentCanvasAssetRef[];
};

const draggableButtonClass =
  'inline-flex w-fit max-w-full items-center gap-3 overflow-hidden rounded-[12px] border border-[#cfcfcb] bg-white px-3 py-2.5 text-left text-sm font-medium text-[#171717] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_3px_0_rgba(203,203,199,0.95),0_10px_18px_rgba(0,0,0,0.06)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[#111111] hover:bg-[#f3f3f1] hover:shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_5px_0_rgba(24,24,24,0.12),0_14px_22px_rgba(0,0,0,0.08)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_1px_0_rgba(203,203,199,0.88),0_6px_10px_rgba(0,0,0,0.05)]';

const setCustomDragPreview = (event: React.DragEvent<HTMLElement>, label: string) => {
  const preview = document.createElement('div');
  preview.textContent = label;
  preview.style.position = 'fixed';
  preview.style.top = '-9999px';
  preview.style.left = '-9999px';
  preview.style.padding = '10px 14px';
  preview.style.borderRadius = '18px';
  preview.style.border = '1px solid #dad6cb';
  preview.style.background = 'rgba(255,255,255,0.98)';
  preview.style.color = '#111111';
  preview.style.fontSize = '14px';
  preview.style.fontWeight = '600';
  preview.style.lineHeight = '1';
  preview.style.boxShadow = '0 12px 28px rgba(0,0,0,0.12)';
  preview.style.pointerEvents = 'none';
  preview.style.zIndex = '9999';
  preview.style.whiteSpace = 'nowrap';

  document.body.appendChild(preview);
  event.dataTransfer.setDragImage(preview, 18, 18);

  window.setTimeout(() => {
    preview.remove();
  }, 0);
};

const getToolbarIcon = (key: string) => {
  if (key === 'avatar') return User;
  if (key === 'product') return Box;
  if (key === 'video') return Video;
  return Sparkles;
};

const getAssetFallbackIcon = (type: ProjectAgentAssetNodeType) => {
  if (type === 'avatar') return User;
  if (type === 'product') return Package2;
  return Video;
};

const getFeatureIcon = (type: ProjectAgentFeatureNodeType) => {
  if (type === 'video_clone') return Clapperboard;
  if (type === 'avatar_ads') return User;
  return Sparkles;
};

const DragItem = ({
  label,
  payload,
  leading,
}: {
  label: string;
  payload: Record<string, unknown>;
  leading: ReactNode;
}) => (
  <button
    className={draggableButtonClass}
    draggable
    onDragStart={(event) => {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', JSON.stringify(payload));
      setCustomDragPreview(event, label);
    }}
    type="button"
    title={label}
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[#d8d8d4] bg-[#f1f1ef]">
      {leading}
    </span>
    <span className="max-w-[240px] truncate whitespace-nowrap pr-1">{label}</span>
  </button>
);

const AssetList = ({
  items,
  type,
}: {
  items: ProjectAgentCanvasAssetRef[];
  type: ProjectAgentAssetNodeType;
}) => (
  <div className="flex flex-col items-start gap-2">
    {items.length === 0 ? (
      <p className="rounded-[14px] border border-dashed border-[#d4d4d4] bg-[#fafafa] px-3 py-3 text-xs text-[#737373]">
        No {type} assets yet.
      </p>
    ) : (
      items.map((item) => {
        const FallbackIcon = getAssetFallbackIcon(type);
        return (
          <DragItem
            key={`${type}-${item.id}`}
            label={item.name}
            payload={{ kind: 'asset', type, asset: item }}
            leading={
              item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={item.name} className="h-full w-full object-cover" src={item.imageUrl} />
              ) : (
                <FallbackIcon className="h-4.5 w-4.5 text-[#787871]" />
              )
            }
          />
        );
      })
    )}
  </div>
);

export default function InsertToolbar({
  avatars,
  products,
  videos,
}: InsertToolbarProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [dropdownOffset, setDropdownOffset] = useState(0);
  const featureTypes: ProjectAgentFeatureNodeType[] = ['video_clone', 'avatar_ads', 'motion_clone'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (toolbarRef.current?.contains(target)) return;
      setOpenKey(null);
    };

    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!openKey) return;

    const updateOffset = () => {
      const toolbarRect = toolbarRef.current?.getBoundingClientRect();
      const triggerRect = triggerRefs.current[openKey]?.getBoundingClientRect();
      if (!toolbarRect || !triggerRect) return;
      const desiredLeft = triggerRect.left - toolbarRect.left;
      setDropdownOffset(Math.max(0, desiredLeft));
    };

    updateOffset();

    window.addEventListener('resize', updateOffset);

    return () => {
      window.removeEventListener('resize', updateOffset);
    };
  }, [openKey]);

  const renderDropdownContent = () => {
    if (openKey === 'avatar') return <AssetList items={avatars} type="avatar" />;
    if (openKey === 'product') return <AssetList items={products} type="product" />;
    if (openKey === 'video') return <AssetList items={videos} type="video" />;
    if (openKey === 'feature') {
      return (
        <div className="flex flex-col items-start gap-2">
          {featureTypes.map((featureType) => {
            const FeatureIcon = getFeatureIcon(featureType);
            return (
              <DragItem
                key={featureType}
                label={getProjectAgentFeatureDisplayName(featureType)}
                payload={{ kind: 'feature', featureType }}
                leading={<FeatureIcon className="h-4.5 w-4.5 text-[#787871]" />}
              />
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      ref={toolbarRef}
      className="pointer-events-auto relative max-w-full rounded-[20px] border border-[#cdcdca] bg-[#f1f1ef] p-2 shadow-[0_14px_30px_rgba(0,0,0,0.08)] backdrop-blur"
    >
      {openKey ? (
        <div
          className="absolute bottom-[calc(100%+10px)] z-20 inline-flex w-fit max-w-[360px] rounded-[16px] border border-[#cdcdca] bg-[#f1f1ef] p-2 shadow-[0_16px_36px_rgba(0,0,0,0.10)]"
          style={{ left: dropdownOffset, width: 'fit-content' }}
        >
          <div className="max-h-[min(60vh,420px)] overflow-y-auto pr-1">
            {renderDropdownContent()}
          </div>
        </div>
      ) : null}
      <div className="flex items-end gap-1.5 max-[1320px]:gap-1.5">
        {[
          { key: 'avatar', label: 'Avatar' },
          { key: 'product', label: 'Product' },
          { key: 'video', label: 'Video' },
          { key: 'feature', label: 'Feature' },
        ].map((entry) => {
          const EntryIcon = getToolbarIcon(entry.key);
          const open = openKey === entry.key;

          return (
          <div className="relative min-w-0 shrink" key={entry.key}>
            <button
              ref={(element) => {
                triggerRefs.current[entry.key] = element;
              }}
              className={`flex h-11 min-w-0 items-center gap-1.5 rounded-[12px] border px-3 py-2 text-sm font-semibold transition-all duration-150 max-[1320px]:w-11 max-[1320px]:justify-center max-[1320px]:px-0 ${
                open
                  ? 'border-[#111111] bg-[#111111] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_3px_0_rgba(20,20,20,0.95),0_12px_20px_rgba(0,0,0,0.16)] hover:-translate-y-[1px] hover:bg-[#1a1a1a] hover:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_5px_0_rgba(20,20,20,0.95),0_16px_24px_rgba(0,0,0,0.18)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_1px_0_rgba(20,20,20,0.9),0_8px_12px_rgba(0,0,0,0.14)]'
                  : 'border-[#cfcfcb] bg-white text-[#2a2a2a] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_3px_0_rgba(203,203,199,0.95),0_10px_18px_rgba(0,0,0,0.06)] hover:-translate-y-[1px] hover:border-[#111111] hover:bg-[#f6f6f4] hover:shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_5px_0_rgba(24,24,24,0.12),0_14px_22px_rgba(0,0,0,0.08)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_1px_0_rgba(203,203,199,0.88),0_6px_10px_rgba(0,0,0,0.05)]'
              }`}
              onClick={() => setOpenKey((current) => current === entry.key ? null : entry.key)}
              type="button"
              aria-label={entry.label}
              title={entry.label}
            >
              <EntryIcon className="h-4 w-4 shrink-0" />
              <span className="truncate max-[1320px]:hidden">{entry.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>
          );
        })}

        {/* Text node — directly draggable, no dropdown */}
        <div
          className="flex h-11 shrink cursor-grab items-center gap-1.5 overflow-hidden rounded-[12px] border border-[#cfcfcb] bg-white px-3 py-2 text-sm font-semibold text-[#2a2a2a] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_3px_0_rgba(203,203,199,0.95),0_10px_18px_rgba(0,0,0,0.06)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[#111111] hover:bg-[#f6f6f4] hover:shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_5px_0_rgba(24,24,24,0.12),0_14px_22px_rgba(0,0,0,0.08)] active:translate-y-[2px] active:cursor-grabbing active:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_1px_0_rgba(203,203,199,0.88),0_6px_10px_rgba(0,0,0,0.05)] max-[1320px]:w-11 max-[1320px]:justify-center max-[1320px]:px-0"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('application/json', JSON.stringify({ kind: 'text' }));
            setCustomDragPreview(event, 'Text');
          }}
          title="Text"
        >
          <Type className="h-4 w-4 shrink-0" />
          <span className="max-[1320px]:hidden">Text</span>
        </div>
      </div>
    </div>
  );
}
