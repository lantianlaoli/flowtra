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
      className="relative bg-white border border-[#E5E5E5] rounded-lg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.08)] transition-shadow duration-200"
    >
      {/* Header with Coins Icon and Label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
            <Coins className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-medium text-black">Credits</span>
        </div>

        {/* Add Credits Button */}
        <button
          onClick={onAddCredits}
          className="w-8 h-8 bg-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-200 group"
          aria-label="Add credits"
        >
          <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Credit Count - Simple display without constant animation */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-black tabular-nums">
            {credits.toLocaleString()}
          </div>

          {/* Breakdown - Show only if user has both subscription and purchased credits */}
          {hasBothTypes && (
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span>Subscription: {subscriptionCredits.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Purchased: {purchasedCredits.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {/* Manage Subscription Button - Show only for subscribers */}
        {hasSubscription && onManageSubscription && (
          <button
            onClick={onManageSubscription}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1.5"
            aria-label="Manage subscription"
          >
            <Settings className="w-3.5 h-3.5" strokeWidth={2} />
            Manage
          </button>
        )}
      </div>

      {/* Subtle decorative line */}
      <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#E5E5E5] to-transparent opacity-50" />
    </div>
  );
}
