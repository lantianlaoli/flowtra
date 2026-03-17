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

export default function CreditsDisplay({
  credits,
  subscriptionCredits = 0,
  purchasedCredits = 0,
  onAddCredits,
  onManageSubscription
}: CreditsDisplayProps) {
  const hasSubscription = subscriptionCredits > 0;

  return (
    <div className="sidebar-credits-shell flex min-w-0 items-center gap-2.5 rounded-2xl border border-[#DDDDDD] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
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
          className="sidebar-credits-secondary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#E5E5E5] bg-[#F7F7F7] text-[#666666] transition-colors hover:border-[#D2D2D2] hover:bg-[#F1F1F1] hover:text-[#111111]"
          aria-label="Manage subscription"
        >
          <Settings2 className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : (
        <button
          onClick={onAddCredits}
          className={cn(
            "sidebar-credits-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#111111] bg-[#111111] text-white transition-colors",
            "hover:bg-black"
          )}
          aria-label="Add credits"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      )}

      {!hasSubscription && onManageSubscription ? (
        <button
          onClick={onAddCredits}
          className="sidebar-credits-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#111111] bg-[#111111] text-white transition-colors hover:bg-black"
          aria-label="Add credits"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      ) : null}

      {hasSubscription && onManageSubscription && (
        <button
          onClick={onAddCredits}
          className="sidebar-credits-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#111111] bg-[#111111] text-white transition-colors hover:bg-black"
          aria-label="Add credits"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
