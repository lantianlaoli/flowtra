'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Box, ChevronDown, Clapperboard, Package2, Sparkles, Type, User, Video } from 'lucide-react';
import { useI18n } from '@/providers/I18nProvider';
import {
  getProjectAgentFeatureDisplayName,
  type ProjectAgentCanvasAssetRef,
  type ProjectAgentFeatureNodeType,
} from '@/lib/project-agent/canvas-state';
import type { ProjectAgentSelectableAssetType } from '@/lib/project-agent/canvas-actions';

type InsertToolbarKey = 'avatar' | 'product' | 'video' | 'feature';

type InsertToolbarProps = {
  avatars: ProjectAgentCanvasAssetRef[];
  products: ProjectAgentCanvasAssetRef[];
  videos: ProjectAgentCanvasAssetRef[];
  openKey?: InsertToolbarKey | null;
  onOpenKeyChange?: (next: InsertToolbarKey | null) => void;
  onQuickUploadRequest?: (assetType: Extract<ProjectAgentSelectableAssetType, 'avatar' | 'product'>) => void;
  selectionMode?: {
    assetType: ProjectAgentSelectableAssetType;
    title: string;
    instructions: string;
  } | null;
  onAssetSelect?: (assetType: ProjectAgentSelectableAssetType, asset: ProjectAgentCanvasAssetRef) => void;
};

const draggableButtonClass =
  'project-agent-insert-item inline-flex min-h-14 w-full max-w-full items-center gap-3 overflow-hidden rounded-[12px] border border-[#cfcfcb] bg-white px-3 py-2.5 text-left text-sm font-medium text-[#171717] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_3px_0_rgba(203,203,199,0.95),0_10px_18px_rgba(0,0,0,0.06)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[#111111] hover:bg-[#f3f3f1] hover:shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_5px_0_rgba(24,24,24,0.12),0_14px_22px_rgba(0,0,0,0.08)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_1px_0_rgba(203,203,199,0.88),0_6px_10px_rgba(0,0,0,0.05)]';
const actionButtonClass =
  'project-agent-insert-upload inline-flex w-fit max-w-full items-center gap-3 overflow-hidden rounded-[12px] border border-dashed border-[#cfcfcb] bg-[#fcfcfb] px-3 py-2.5 text-left text-sm font-medium text-[#171717] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_3px_0_rgba(203,203,199,0.75),0_10px_18px_rgba(0,0,0,0.04)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[#111111] hover:bg-[#f3f3f1] hover:shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_5px_0_rgba(24,24,24,0.12),0_14px_22px_rgba(0,0,0,0.08)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_1px_0_rgba(203,203,199,0.88),0_6px_10px_rgba(0,0,0,0.05)]';

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

const getAssetFallbackIcon = (type: ProjectAgentSelectableAssetType) => {
  if (type === 'avatar') return User;
  if (type === 'product') return Package2;
  return Video;
};

const getFeatureIcon = (type: ProjectAgentFeatureNodeType) => {
  if (type === 'video_clone') return Clapperboard;
  if (type === 'avatar_ads') return User;
  return Sparkles;
};

const getToolbarMessages = (locale: string) => {
  if (locale === 'zh') {
    return {
      categories: {
        avatar: '头像',
        product: '产品',
        video: '视频',
        feature: '功能',
      },
      text: '文本',
      quickUpload: {
        avatar: '上传头像',
        product: '上传产品',
      },
      empty: {
        avatar: '还没有头像资源。',
        product: '还没有产品资源。',
        video: '还没有视频资源。',
      },
    };
  }

  return {
    categories: {
      avatar: 'Avatar',
      product: 'Product',
      video: 'Video',
      feature: 'Feature',
    },
    text: 'Text',
    quickUpload: {
      avatar: 'Upload avatar',
      product: 'Upload product',
    },
    empty: {
      avatar: 'No avatar assets yet.',
      product: 'No product assets yet.',
      video: 'No video assets yet.',
    },
  };
};

const DragItem = ({
  label,
  payload,
  leading,
  onClick,
  isSystem = false,
}: {
  label: string;
  payload: Record<string, unknown>;
  leading: ReactNode;
  onClick?: () => void;
  isSystem?: boolean;
}) => (
  <button
    className={draggableButtonClass}
    draggable
    onDragStart={(event) => {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', JSON.stringify(payload));
      setCustomDragPreview(event, label);
    }}
    onClick={onClick}
    type="button"
    title={label}
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[#d8d8d4] bg-[#f1f1ef]">
      {leading}
    </span>
    <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-1">
      <span className="max-w-[240px] truncate whitespace-nowrap leading-5">{label}</span>
      {isSystem ? (
        <span className="project-agent-insert-system-tag inline-flex w-fit items-center rounded-full border border-[#d7d4ca] bg-[#f7f7f5] px-2 py-0.5 text-[11px] font-semibold leading-none text-[#5f5f58]">
          Default
        </span>
      ) : null}
    </span>
  </button>
);

const QuickUploadTile = ({
  assetType,
  onClick,
  label,
}: {
  assetType: Extract<ProjectAgentSelectableAssetType, 'avatar' | 'product'>;
  onClick: () => void;
  label: string;
}) => {
  const Icon = assetType === 'avatar' ? User : Package2;

  return (
    <button
      className={actionButtonClass}
      onClick={onClick}
      type="button"
      title={label}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-dashed border-[#d8d8d4] bg-white">
        <Icon className="h-4.5 w-4.5 text-[#787871]" />
      </span>
      <span className="max-w-[240px] truncate whitespace-nowrap pr-1">{label}</span>
    </button>
  );
};

const AssetList = ({
  items,
  type,
  selectionMode,
  onAssetSelect,
  onQuickUploadRequest,
  locale,
}: {
  items: ProjectAgentCanvasAssetRef[];
  type: ProjectAgentSelectableAssetType;
  selectionMode?: InsertToolbarProps['selectionMode'];
  onAssetSelect?: InsertToolbarProps['onAssetSelect'];
  onQuickUploadRequest?: InsertToolbarProps['onQuickUploadRequest'];
  locale: string;
}) => {
  const hasQuickUpload = (type === 'avatar' || type === 'product') && Boolean(onQuickUploadRequest);
  const messages = getToolbarMessages(locale);

  return (
    <div className="flex min-w-[280px] flex-col items-start">
      <div className="flex max-h-[min(52vh,340px)] w-full flex-col items-start gap-2.5 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="project-agent-insert-empty rounded-[14px] border border-dashed border-[#d4d4d4] bg-[#fafafa] px-3 py-3 text-xs text-[#737373]">
            {messages.empty[type as keyof typeof messages.empty] || messages.empty.video}
          </p>
        ) : (
          items.map((item) => {
            const FallbackIcon = getAssetFallbackIcon(type);
            return (
              <DragItem
                key={`${type}-${item.id}`}
                label={item.name}
                payload={{ kind: 'asset', type, asset: item }}
                onClick={selectionMode?.assetType === type && onAssetSelect ? () => onAssetSelect(type, item) : undefined}
                isSystem={item.isSystem === true}
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
      {hasQuickUpload && onQuickUploadRequest ? (
        <div className="project-agent-insert-footer sticky bottom-0 mt-2 w-full border-t border-[#d9d9d6] bg-[#f1f1ef] pt-2">
          <QuickUploadTile
            assetType={type as 'avatar' | 'product'}
            label={messages.quickUpload[type as 'avatar' | 'product']}
            onClick={() => onQuickUploadRequest(type as 'avatar' | 'product')}
          />
        </div>
      ) : null}
    </div>
  );
};

export default function InsertToolbar({
  avatars,
  products,
  videos,
  openKey: controlledOpenKey,
  onOpenKeyChange,
  onQuickUploadRequest,
  selectionMode = null,
  onAssetSelect,
}: InsertToolbarProps) {
  const { locale } = useI18n();
  const [internalOpenKey, setInternalOpenKey] = useState<InsertToolbarKey | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<InsertToolbarKey, HTMLButtonElement | null>>({
    avatar: null,
    product: null,
    video: null,
    feature: null,
  });
  const [dropdownOffset, setDropdownOffset] = useState(0);
  const featureTypes: ProjectAgentFeatureNodeType[] = ['video_clone', 'avatar_ads', 'motion_clone'];
  const openKey = controlledOpenKey ?? internalOpenKey;
  const messages = getToolbarMessages(locale);

  const setOpenKey = useCallback((next: InsertToolbarKey | null) => {
    onOpenKeyChange?.(next);
    if (controlledOpenKey === undefined) {
      setInternalOpenKey(next);
    }
  }, [controlledOpenKey, onOpenKeyChange]);

  useEffect(() => {
    if (!selectionMode) return;
    setOpenKey(selectionMode.assetType);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionMode?.assetType]);

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
  }, [setOpenKey]);

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
    if (openKey === 'avatar') return <AssetList items={avatars} type="avatar" locale={locale} selectionMode={selectionMode} onAssetSelect={onAssetSelect} onQuickUploadRequest={onQuickUploadRequest} />;
    if (openKey === 'product') return <AssetList items={products} type="product" locale={locale} selectionMode={selectionMode} onAssetSelect={onAssetSelect} onQuickUploadRequest={onQuickUploadRequest} />;
    if (openKey === 'video') return <AssetList items={videos} type="video" locale={locale} selectionMode={selectionMode} onAssetSelect={onAssetSelect} />;
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
      className="project-agent-insert-toolbar pointer-events-auto relative max-w-full rounded-[20px] border border-[#cdcdca] bg-[#f1f1ef] p-2 shadow-[0_14px_30px_rgba(0,0,0,0.08)] backdrop-blur"
    >
      {openKey ? (
        <div
          className="project-agent-insert-dropdown absolute bottom-[calc(100%+10px)] z-20 inline-flex w-fit max-w-[360px] rounded-[16px] border border-[#cdcdca] bg-[#f1f1ef] p-2 shadow-[0_16px_36px_rgba(0,0,0,0.10)]"
          style={{ left: dropdownOffset, width: 'fit-content' }}
        >
          {renderDropdownContent()}
        </div>
      ) : null}
      <div className="flex items-end gap-1.5 max-[1320px]:gap-1.5">
        {([
          { key: 'avatar', label: messages.categories.avatar },
          { key: 'product', label: messages.categories.product },
          { key: 'video', label: messages.categories.video },
          { key: 'feature', label: messages.categories.feature },
        ] as const).map((entry) => {
          const EntryIcon = getToolbarIcon(entry.key);
          const open = openKey === entry.key;

          return (
          <div className="relative min-w-0 shrink" key={entry.key}>
            <button
              ref={(element) => {
                triggerRefs.current[entry.key] = element;
              }}
              className={`project-agent-insert-trigger flex h-11 min-w-0 items-center gap-1.5 rounded-[12px] border px-3 py-2 text-sm font-semibold transition-all duration-150 max-[1320px]:w-11 max-[1320px]:justify-center max-[1320px]:px-0 ${
                open
                  ? 'project-agent-insert-trigger--active border-[#111111] bg-[#111111] text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_3px_0_rgba(20,20,20,0.95),0_12px_20px_rgba(0,0,0,0.16)] hover:-translate-y-[1px] hover:bg-[#1a1a1a] hover:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_5px_0_rgba(20,20,20,0.95),0_16px_24px_rgba(0,0,0,0.18)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_1px_0_rgba(20,20,20,0.9),0_8px_12px_rgba(0,0,0,0.14)]'
                  : 'border-[#cfcfcb] bg-white text-[#2a2a2a] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_3px_0_rgba(203,203,199,0.95),0_10px_18px_rgba(0,0,0,0.06)] hover:-translate-y-[1px] hover:border-[#111111] hover:bg-[#f6f6f4] hover:shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_5px_0_rgba(24,24,24,0.12),0_14px_22px_rgba(0,0,0,0.08)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_1px_0_rgba(203,203,199,0.88),0_6px_10px_rgba(0,0,0,0.05)]'
              }`}
              onClick={() => setOpenKey(open ? null : entry.key)}
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
          className="project-agent-insert-trigger project-agent-insert-text-trigger flex h-11 shrink cursor-grab items-center gap-1.5 overflow-hidden rounded-[12px] border border-[#cfcfcb] bg-white px-3 py-2 text-sm font-semibold text-[#2a2a2a] shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_3px_0_rgba(203,203,199,0.95),0_10px_18px_rgba(0,0,0,0.06)] transition-all duration-150 hover:-translate-y-[1px] hover:border-[#111111] hover:bg-[#f6f6f4] hover:shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_5px_0_rgba(24,24,24,0.12),0_14px_22px_rgba(0,0,0,0.08)] active:translate-y-[2px] active:cursor-grabbing active:shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_1px_0_rgba(203,203,199,0.88),0_6px_10px_rgba(0,0,0,0.05)] max-[1320px]:w-11 max-[1320px]:justify-center max-[1320px]:px-0"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'copy';
            event.dataTransfer.setData('application/json', JSON.stringify({ kind: 'text' }));
            setCustomDragPreview(event, messages.text);
          }}
          title={messages.text}
        >
          <Type className="h-4 w-4 shrink-0" />
          <span className="max-[1320px]:hidden">{messages.text}</span>
        </div>
      </div>
    </div>
  );
}
