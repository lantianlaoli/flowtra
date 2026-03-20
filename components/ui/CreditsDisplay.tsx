'use client';

import { Coins, Plus, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditsDisplayProps {
  credits: number;
  subscriptionCredits?: number;
  purchasedCredits?: number;
  onAddCredits: () => void;
  onManageSubscription?: () => void;
}

const sidebarSecondaryIconButtonClassName =
  'sidebar-credits-button sidebar-credits-button--secondary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all duration-150';

const sidebarPrimaryIconButtonClassName =
  'sidebar-credits-button sidebar-credits-button--primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all duration-150';

export default function CreditsDisplay({
  credits,
  subscriptionCredits = 0,
  purchasedCredits = 0,
  onAddCredits,
  onManageSubscription
}: CreditsDisplayProps) {
  const hasSubscription = subscriptionCredits > 0;

  return (
    <div className="sidebar-credits-shell inline-flex w-fit max-w-full items-center gap-2 rounded-[24px] border px-2.5 py-2 backdrop-blur-xl">
      <div className="sidebar-credits-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-white">
        <Coins className="h-4 w-4" strokeWidth={2.2} />
      </div>

      <div className="shrink-0">
        <div className="sidebar-credits-value whitespace-nowrap text-[17px] font-semibold tracking-[-0.02em] text-[#111111] tabular-nums">
          {credits.toLocaleString()}
        </div>
      </div>

      {hasSubscription && onManageSubscription ? (
        <button
          onClick={onManageSubscription}
          className={sidebarSecondaryIconButtonClassName}
          aria-label="Manage subscription"
        >
          <Settings2 className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : (
        <button
          onClick={onAddCredits}
          className={cn('sidebar-credits-primary', sidebarPrimaryIconButtonClassName)}
          aria-label="Add credits"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      )}

      {!hasSubscription && onManageSubscription ? (
        <button
          onClick={onAddCredits}
          className={cn('sidebar-credits-primary', sidebarPrimaryIconButtonClassName)}
          aria-label="Add credits"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      ) : null}

      {hasSubscription && onManageSubscription && (
        <button
          onClick={onAddCredits}
          className={cn('sidebar-credits-primary', sidebarPrimaryIconButtonClassName)}
          aria-label="Add credits"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
