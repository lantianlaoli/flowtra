'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

type FloatingWorkspacePanelProps = {
  title: string;
  description?: string;
  onClose: () => void;
  visible?: boolean;
  children: ReactNode;
};

export default function FloatingWorkspacePanel({
  title,
  description,
  onClose,
  visible = true,
  children,
}: FloatingWorkspacePanelProps) {
  return (
    <section
      aria-hidden={!visible}
      className={`project-agent-card absolute right-5 top-[84px] z-40 flex h-[min(68vh,720px)] w-[min(1040px,calc(100vw-2.5rem))] min-h-0 flex-col overflow-hidden rounded-[24px] border shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur transition-opacity max-[900px]:left-5 max-[900px]:w-auto max-[760px]:inset-x-3 max-[760px]:top-[128px] max-[760px]:h-[min(60vh,520px)] ${
        visible ? 'opacity-100' : 'pointer-events-none invisible opacity-0'
      }`}
    >
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#ebe6da] px-5 py-3.5">
        <div>
          <h2 className="text-base font-semibold text-black">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-[#6f6a62]">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="project-agent-press-button inline-flex h-9 w-9 items-center justify-center rounded-full"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background">{children}</div>
    </section>
  );
}
