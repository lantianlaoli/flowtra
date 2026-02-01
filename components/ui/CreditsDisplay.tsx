'use client';

import { Coins, Plus, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const hasBothTypes = subscriptionCredits > 0 && purchasedCredits > 0;
  return (
    <div
      className="relative bg-card border border-border rounded-lg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-shadow duration-200"
    >
      {/* Header with Coins Icon and Label */}
      <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <Coins className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-medium text-foreground">Credits</span>
        </div>

        {/* Add Credits Button */}
        <button
          onClick={onAddCredits}
          className="w-8 h-8 bg-primary rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-200 group"
          aria-label="Add credits"
        >
          <Plus className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
        </button>
      </div>

      {/* Credit Count - Simple display without constant animation */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-foreground tabular-nums">
            {credits.toLocaleString()}
          </div>
        </div>

        {/* Manage Subscription Button - Show only for subscribers */}
        {hasSubscription && onManageSubscription && (
          <button
            onClick={onManageSubscription}
            className="px-3 py-1.5 text-xs font-medium text-foreground bg-muted rounded-md hover:bg-muted/80 transition-colors flex items-center gap-1.5"
            aria-label="Manage subscription"
          >
            <Settings className="w-3.5 h-3.5" strokeWidth={2} />
            Manage
          </button>
        )}
      </div>

      {/* Subtle decorative line */}
      <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />
    </div>
  );
}
