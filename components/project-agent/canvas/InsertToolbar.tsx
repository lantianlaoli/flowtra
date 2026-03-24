'use client';

import { type ReactNode, useState } from 'react';
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
  'flex w-full items-center gap-3 rounded-[18px] border border-[#dedbd1] bg-white px-3 py-2.5 text-left text-sm font-medium text-black shadow-[0_10px_24px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-[#cfc9bb]';

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
    }}
    type="button"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f4f2ea]">
      {leading}
    </span>
    <span className="truncate whitespace-nowrap pr-2">{label}</span>
  </button>
);

const AssetList = ({
  items,
  type,
}: {
  items: ProjectAgentCanvasAssetRef[];
  type: ProjectAgentAssetNodeType;
}) => (
  <div className="grid gap-2">
    {items.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-[#ddd9ce] px-3 py-3 text-xs text-[#7c7c76]">
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
  const featureTypes: ProjectAgentFeatureNodeType[] = ['video_clone', 'avatar_ads', 'motion_clone'];

  return (
    <div className="pointer-events-auto rounded-[28px] border border-[#ddd9ce] bg-white/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur">
      <div className="flex items-end gap-2">
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
              className={`flex min-w-0 items-center gap-1.5 rounded-[22px] border px-3 py-2.5 text-sm font-semibold ${
                open
                  ? 'border-black bg-black text-white'
                  : 'border-[#dad6cb] bg-[#f8f7f2] text-black'
              }`}
              onClick={() => setOpenKey((current) => current === entry.key ? null : entry.key)}
              type="button"
            >
              <EntryIcon className="h-4 w-4 shrink-0" />
              <span className="hidden min-[520px]:inline truncate">{entry.label}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {openKey === entry.key ? (
              <div className="absolute bottom-[calc(100%+12px)] left-0 z-20 min-w-[220px] rounded-[24px] border border-[#ddd9ce] bg-white p-3 shadow-[0_24px_60px_rgba(0,0,0,0.16)]">
                {entry.key === 'avatar' ? <AssetList items={avatars} type="avatar" /> : null}
                {entry.key === 'product' ? <AssetList items={products} type="product" /> : null}
                {entry.key === 'video' ? <AssetList items={videos} type="video" /> : null}
                {entry.key === 'feature' ? (
                  <div className="grid gap-2">
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
                ) : null}
              </div>
            ) : null}
          </div>
          );
        })}

        {/* Text node — directly draggable, no dropdown */}
        <div
          className="flex shrink cursor-grab items-center gap-1.5 overflow-hidden rounded-[22px] border border-[#dad6cb] bg-[#f8f7f2] px-3 py-2.5 text-sm font-semibold text-black active:cursor-grabbing"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('application/json', JSON.stringify({ kind: 'text' }));
          }}
        >
          <Type className="h-4 w-4 shrink-0" />
          <span className="hidden min-[520px]:inline">Text</span>
        </div>
      </div>
    </div>
  );
}
