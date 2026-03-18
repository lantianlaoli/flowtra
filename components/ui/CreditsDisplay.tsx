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
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#ECECE8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFCFB_100%)] text-[#666666] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_3px_0_rgba(232,232,228,0.98),0_10px_18px_rgba(15,23,42,0.035)] transition-all duration-150 hover:translate-y-[2px] hover:border-[#E7E7E2] hover:bg-[linear-gradient(180deg,#FDFDFC_0%,#F8F8F6_100%)] hover:text-[#111111] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_0_rgba(232,232,228,0.98),0_7px_12px_rgba(15,23,42,0.028)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_0px_0_rgba(232,232,228,0.98),0_4px_8px_rgba(15,23,42,0.022)]';

const sidebarPrimaryIconButtonClassName =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#111111] bg-[linear-gradient(180deg,#171717_0%,#111111_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_0_rgba(72,72,72,0.95),0_10px_18px_rgba(0,0,0,0.12)] transition-all duration-150 hover:translate-y-[2px] hover:bg-[linear-gradient(180deg,#161616_0%,#101010_100%)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_2px_0_rgba(72,72,72,0.95),0_7px_12px_rgba(0,0,0,0.1)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_0_rgba(72,72,72,0.95),0_4px_8px_rgba(0,0,0,0.09)]';

export default function CreditsDisplay({
  credits,
  subscriptionCredits = 0,
  purchasedCredits = 0,
  onAddCredits,
  onManageSubscription
}: CreditsDisplayProps) {
  const hasSubscription = subscriptionCredits > 0;

  return (
    <div className="sidebar-credits-shell flex min-w-0 items-center gap-2 rounded-[24px] border border-[#E7E7E4] bg-white/92 px-2.5 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <div className="sidebar-credits-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#111111] text-white">
        <Coins className="h-4 w-4" strokeWidth={2.2} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="sidebar-credits-value truncate text-[17px] font-semibold tracking-[-0.02em] text-[#111111] tabular-nums">
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
