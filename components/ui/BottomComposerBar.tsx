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
  className = ''
}: BottomComposerBarProps) {
  const canAfford = userCredits >= generationCost;
  const showInsufficientCredits = !canAfford && generationCost > 0;

  return (
    <div className={`fixed bottom-0 left-0 right-0 md:left-72 z-40 px-8 md:px-12 lg:px-16 pb-6 ${className}`}>
      <div className="max-w-[1280px] mx-auto space-y-3">
        <div className="bg-white/98 backdrop-blur border border-[#E5E5E5] rounded-[32px] shadow-[0_20px_40px_rgba(0,0,0,0.1)] px-6 py-4 flex flex-wrap items-center gap-3">
          {/* Left controls - dynamic per page */}
          {leftControls && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {leftControls}
            </div>
          )}

          {/* Center input - dynamic per page */}
          {centerInput && (
            <div className="flex-1 min-w-[240px]">
              {centerInput}
            </div>
          )}

          {/* Right actions - standardized */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {/* Config button */}
            {configButton}

            {/* Generate button - standardized */}
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={onGenerate}
                disabled={!canGenerate || isGenerating}
                className={`
                  flex items-center gap-2.5 px-6 py-3 rounded-lg cursor-pointer
                  font-semibold text-sm whitespace-nowrap min-w-[260px]
                  transition-all duration-200
                  ${canGenerate && !isGenerating
                    ? 'bg-black hover:bg-black/90 text-white shadow-[0_20px_40px_rgba(0,0,0,0.1)]'
                    : 'bg-[#E5E5E5] text-[#666666] cursor-not-allowed'
                  }
                `}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {showInsufficientCredits
                    ? 'Insufficient Credits'
                    : isGenerating
                    ? 'Generating...'
                    : generateButtonText
                  }
                </span>
                {showInsufficientCredits && (
                  <span className="ml-2 flex items-center gap-1 px-2.5 py-1 bg-red-500/30 rounded-full text-xs font-bold backdrop-blur-sm">
                    Need {generationCost}, Have {userCredits}
                  </span>
                )}
                {canAfford && !isGenerating && generationCost > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded ml-auto text-xs">
                    <Coins className="w-3 h-3" />
                    {generationCost}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
