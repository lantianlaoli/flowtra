'use client';

import { Sparkles } from 'lucide-react';
import { ReactNode } from 'react';
import { useI18n } from '@/providers/I18nProvider';

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

export function resolveBottomComposerButtonLabel(input: {
  showInsufficientCredits: boolean;
  isGenerating: boolean;
  generateButtonText?: string;
}) {
  const { showInsufficientCredits, isGenerating, generateButtonText = 'Generate' } = input;

  if (showInsufficientCredits) {
    return 'Insufficient';
  }

  if (!isGenerating) {
    return generateButtonText;
  }

  return generateButtonText.trim().toLowerCase() === 'start'
    ? 'Processing...'
    : 'Generating...';
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
  const { locale } = useI18n();
  const canAfford = userCredits >= generationCost;
  const showInsufficientCredits = !canAfford && generationCost > 0;
  const isButtonDisabled = !canGenerate || isGenerating || showInsufficientCredits;
  const localizedGenerateButtonText =
    generateButtonText === 'Start'
      ? (locale === 'zh' ? '开始' : 'Start')
      : generateButtonText === 'Generate'
        ? (locale === 'zh' ? '生成' : 'Generate')
        : generateButtonText;
  const buttonLabel = resolveBottomComposerButtonLabel({
    showInsufficientCredits,
    isGenerating,
    generateButtonText:
      showInsufficientCredits
        ? (locale === 'zh' ? '积分不足' : 'Insufficient')
        : isGenerating
          ? (localizedGenerateButtonText === (locale === 'zh' ? '开始' : 'Start')
              ? (locale === 'zh' ? '处理中...' : 'Processing...')
              : (locale === 'zh' ? '生成中...' : 'Generating...'))
          : localizedGenerateButtonText,
  });

  return (
    <div className={`bottom-composer-bar ${compact ? 'bottom-composer-bar--compact' : ''} fixed bottom-0 z-40 pb-4 md:pb-6 pointer-events-none ${className}`}>
      <div className={`mx-auto flex w-full ${compact ? 'justify-center' : ''}`}>
        <div className={`bottom-composer-surface rounded-[16px] bg-white/98 backdrop-blur border border-[#E5E5E5] shadow-[0_12px_30px_rgba(0,0,0,0.07)] p-2 flex flex-row items-center gap-2 md:gap-3 pointer-events-auto ${compact ? 'w-fit max-w-full' : 'w-full'}`}>
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
              disabled={isButtonDisabled}
              data-disabled={isButtonDisabled}
              data-generating={isGenerating}
              className={`
                bottom-composer-generate
                my-ads-button ${!isButtonDisabled ? 'my-ads-button--primary' : ''}
                rounded-[16px] flex items-center justify-center gap-2 px-5 h-12 cursor-pointer
                font-semibold text-sm whitespace-nowrap min-w-[138px]
                transition-all duration-200
                ${!isButtonDisabled
                  ? 'border border-black bg-black text-white'
                  : 'bg-[#F7F7F7] text-[#999999] cursor-not-allowed border border-[#E5E5E5] shadow-none'
                }
              `}
            >
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>{buttonLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
