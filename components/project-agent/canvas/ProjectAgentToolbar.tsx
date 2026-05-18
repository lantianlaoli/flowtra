'use client';

import { ArrowLeft, Boxes, Coins, Play, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import SidebarUtilityDock, { type SettingsTab } from '@/components/layout/SidebarUtilityDock';
import SessionSwitcher from '@/components/project-agent/canvas/SessionSwitcher';
import type { ProjectAgentSessionItem } from '@/lib/project-agent/workspace-ui';

type ProjectAgentToolbarProps = {
  sessionsOpen: boolean;
  sessionItems: ProjectAgentSessionItem[];
  credits?: number;
  activePanel: 'my_ads' | 'assets' | null;
  isDarkMode: boolean;
  settingsOpenRequest: { tab: SettingsTab; nonce: number } | null;
  onToggleSessions: () => void;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => void;
  onTogglePanel: (panel: 'my_ads' | 'assets') => void;
  onOpenBilling: () => void;
  onToggleDarkMode: (trigger: HTMLElement) => void;
};

const toolbarButtonClass =
  'project-agent-press-button inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-xs font-semibold';

export default function ProjectAgentToolbar({
  sessionsOpen,
  sessionItems,
  credits,
  activePanel,
  isDarkMode,
  settingsOpenRequest,
  onToggleSessions,
  onSelectSession,
  onCreateSession,
  onTogglePanel,
  onOpenBilling,
  onToggleDarkMode,
}: ProjectAgentToolbarProps) {
  const router = useRouter();

  return (
    <div className="pointer-events-auto absolute right-5 top-5 z-40 flex flex-wrap items-start justify-end gap-2 max-[900px]:right-4 max-[900px]:top-4">
      <SessionSwitcher
        open={sessionsOpen}
        items={sessionItems}
        onToggle={onToggleSessions}
        onSelect={onSelectSession}
        onCreate={onCreateSession}
      />

      <div className="project-agent-press-button inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-xs font-semibold">
        <Coins className="h-3.5 w-3.5" />
        <span>{credits ?? 0}</span>
        <button
          type="button"
          onClick={onOpenBilling}
          aria-label="Manage subscription"
          className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#ddd8cc] bg-white"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onTogglePanel('my_ads')}
        className={`${toolbarButtonClass} ${activePanel === 'my_ads' ? 'project-agent-press-button--active' : ''}`}
      >
        <Play className="h-3.5 w-3.5" />
        <span>My Ads</span>
      </button>

      <button
        type="button"
        onClick={() => onTogglePanel('assets')}
        className={`${toolbarButtonClass} ${activePanel === 'assets' ? 'project-agent-press-button--active' : ''}`}
      >
        <Boxes className="h-3.5 w-3.5" />
        <span>Assets</span>
      </button>

      <SidebarUtilityDock
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
        onNavigateTo={(href) => router.push(href)}
        showReturnButton={false}
        showIdentifier={false}
        openRequest={settingsOpenRequest}
        compact
      />

      <button
        type="button"
        onClick={() => router.push('/')}
        aria-label="Back to landing"
        title="Back to landing"
        className="project-agent-press-button inline-flex h-10 w-10 items-center justify-center rounded-full"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
    </div>
  );
}
