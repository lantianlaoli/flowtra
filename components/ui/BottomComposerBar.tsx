'use client';

import { Sparkles, Coins } from 'lucide-react';
import { ReactNode } from 'react';

interface BottomComposerBarProps {
  // Left controls (specific to each page)
  leftControls?: ReactNode;

  // Center input (specific to each page)
  centerInput?: ReactNode;

  // Config popover (standardized)
  configButton?: ReactNode;

  // Generate button props (standardized)
  onGenerate: () => void;
  canGenerate: boolean;
  isGenerating?: boolean;
  generationCost?: number;
  userCredits?: number;
  generateButtonText?: string;

  // Container props
  className?: string;
  compact?: boolean;
}

export default function BottomComposerBar({
  leftControls,
  centerInput,
  configButton,
  onGenerate,
  canGenerate,
  isGenerating = false,
  generationCost = 0,
  userCredits = 0,
  generateButtonText = 'Generate',
  className = '',
  compact = false
}: BottomComposerBarProps) {
  const canAfford = userCredits >= generationCost;
  const showInsufficientCredits = !canAfford && generationCost > 0;

  return (
    <div className={`fixed bottom-0 left-0 right-0 md:left-72 z-40 px-3 md:px-12 lg:px-16 pb-4 md:pb-6 pointer-events-none ${className}`}>
      <div className={`max-w-[1280px] mx-auto ${compact ? 'flex justify-center' : ''}`}>
        <div className={`bg-white/98 backdrop-blur border border-[#E5E5E5] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.08)] p-2 md:p-3 flex flex-row items-end gap-2 md:gap-3 pointer-events-auto ${compact ? 'w-fit' : ''}`}>
          {/* Left controls - dynamic per page */}
          {leftControls && (
            <div className="flex items-center gap-2 flex-shrink-0 h-12">
              {leftControls}
            </div>
          )}

          {/* Center input - dynamic per page */}
          {centerInput && (
            <div className="flex-1 min-w-[200px] md:min-w-[240px]">
              {centerInput}
            </div>
          )}

          {/* Right actions - standardized */}
          <div className={`flex items-center gap-2 flex-shrink-0 h-12 ${compact ? '' : 'ml-auto'}`}>
            {/* Config button */}
            {configButton}

            {/* Generate button - standardized */}
            <button
              onClick={onGenerate}
              disabled={!canGenerate || isGenerating}
              className={`
                flex items-center justify-center gap-2 px-6 h-12 rounded-lg cursor-pointer
                font-semibold text-sm whitespace-nowrap min-w-[140px]
                transition-all duration-200
                ${canGenerate && !isGenerating
                  ? 'bg-black hover:bg-black/90 text-white shadow-sm'
                  : 'bg-[#F7F7F7] text-[#999999] cursor-not-allowed border border-[#E5E5E5]'
                }
              `}
            >
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>
                {showInsufficientCredits
                  ? 'Insufficient'
                  : isGenerating
                  ? 'Generating...'
                  : generateButtonText
                }
              </span>
              {canAfford && !isGenerating && generationCost > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-md text-xs ml-1">
                  <Coins className="w-3 h-3" />
                  {generationCost}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
