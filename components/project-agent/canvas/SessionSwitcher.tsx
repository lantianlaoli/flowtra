'use client';

import { Clock3, MessageSquareText, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ProjectAgentSessionItem } from '@/lib/project-agent/workspace-ui';

type SessionSwitcherProps = {
  open: boolean;
  items: ProjectAgentSessionItem[];
  onToggle: () => void;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
};

export default function SessionSwitcher({
  open,
  items,
  onToggle,
  onSelect,
  onCreate,
}: SessionSwitcherProps) {
  const active = items.find((item) => item.isActive);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current?.contains(target)) return;
      onToggle();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onToggle, open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="project-agent-press-button inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-xs font-semibold"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MessageSquareText className="h-3.5 w-3.5" />
        <span className="max-w-[120px] truncate">{active?.label || 'Canvas'}</span>
      </button>

      {open ? (
        <div className="project-agent-card absolute right-0 top-[calc(100%+10px)] z-40 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[20px] border p-3 shadow-[0_18px_42px_rgba(0,0,0,0.12)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a6963]">Sessions</p>
            <button
              type="button"
              onClick={onCreate}
              className="project-agent-press-button inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
          <div className="grid max-h-[min(56vh,430px)] gap-2 overflow-x-hidden overflow-y-auto pr-1">
            {items.slice(0, 10).map((item) => (
              <button
                key={item.sessionId}
                type="button"
                onClick={() => onSelect(item.sessionId)}
                className={`min-w-0 rounded-[14px] border px-3 py-2.5 text-left transition-colors ${
                  item.isActive
                    ? 'border-black bg-black text-white'
                    : 'border-[#ebe6da] bg-white text-black hover:bg-[#f8f7f2]'
                }`}
              >
                <p className="truncate text-sm font-semibold">{item.label}</p>
                <p className={`mt-1 flex min-w-0 items-center gap-1.5 text-[11px] ${item.isActive ? 'text-white/70' : 'text-[#77736c]'}`}>
                  <Clock3 className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'New canvas'}
                  </span>
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
