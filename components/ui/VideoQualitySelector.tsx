'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, CircleHelp, Lock, MonitorPlay } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  GENERATION_COSTS,
  HIGH_RES_DOWNLOAD_COSTS,
  normalizeCloneVideoQualityForModel,
  type CloneVideoQuality,
  type VideoModel
} from '@/lib/constants';

interface VideoQualitySelectorProps {
  selectedModel: VideoModel;
  selectedQuality: CloneVideoQuality;
  onQualityChange: (quality: CloneVideoQuality) => void;
  className?: string;
  disabled?: boolean;
}

type QualityOption = {
  value: CloneVideoQuality;
  label: string;
  creditsPerSecondLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
};

const VEO_EXPORT_HINT = 'Export 1080p or 4K from My Ads after generation.';

function formatCreditsPerSecondLabel(totalCredits: number, seconds = 8): string {
  const perSecond = totalCredits / seconds;
  const formatted = Number.isInteger(perSecond) ? String(perSecond) : perSecond.toFixed(2);
  return `${formatted} credits / s`;
}

function getQualityOptions(model: VideoModel): QualityOption[] {
  if (model === 'kling_3') {
    return [
      { value: '720p', label: '720p', creditsPerSecondLabel: '30 credits / s' },
      { value: '1080p', label: '1080p', creditsPerSecondLabel: '40 credits / s' }
    ];
  }

  if (model === 'seedance_1_5_pro') {
    return [
      { value: '480p', label: '480p', creditsPerSecondLabel: '3.5 credits / s' },
      { value: '720p', label: '720p', creditsPerSecondLabel: '7 credits / s' },
      { value: '1080p', label: '1080p', creditsPerSecondLabel: '15 credits / s' }
    ];
  }

  const veoCreditsPerSecond = GENERATION_COSTS[model] / 8;
  const veoCreditsPerSecondLabel = formatCreditsPerSecondLabel(GENERATION_COSTS[model]);
  const veo1080pTotal = GENERATION_COSTS[model] + HIGH_RES_DOWNLOAD_COSTS['1080p'];
  const veo4kTotal = GENERATION_COSTS[model] + HIGH_RES_DOWNLOAD_COSTS['4k'];

  return [
    { value: '720p', label: '720p', creditsPerSecondLabel: veoCreditsPerSecondLabel },
    {
      value: '1080p',
      label: '1080p',
      creditsPerSecondLabel: formatCreditsPerSecondLabel(veo1080pTotal),
      disabled: true,
      disabledReason: VEO_EXPORT_HINT
    },
    {
      value: '4k',
      label: '4K',
      creditsPerSecondLabel: formatCreditsPerSecondLabel(veo4kTotal),
      disabled: true,
      disabledReason: VEO_EXPORT_HINT
    }
  ];
}

export default function VideoQualitySelector({
  selectedModel,
  selectedQuality,
  onQualityChange,
  className,
  disabled = false
}: VideoQualitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const normalizedSelectedQuality = normalizeCloneVideoQualityForModel(selectedModel, selectedQuality);
  const qualityOptions = useMemo(() => getQualityOptions(selectedModel), [selectedModel]);
  const selectedOption = qualityOptions.find((option) => option.value === normalizedSelectedQuality) || qualityOptions[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && optionsRef.current) {
      const options = optionsRef.current;
      const rect = options.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      options.style.top = '';
      options.style.bottom = '';
      options.style.marginTop = '';
      options.style.marginBottom = '';

      if (rect.bottom > viewportHeight && rect.top > rect.height) {
        options.style.top = 'auto';
        options.style.bottom = '100%';
        options.style.marginTop = '0';
        options.style.marginBottom = '0.25rem';
      }
    }
  }, [isOpen]);

  return (
    <div className={cn('space-y-3', className)} ref={dropdownRef}>
      <label className="config-field-label flex items-center gap-2 text-base font-medium text-gray-900">
        <MonitorPlay className="h-4 w-4" />
        Quality
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen((open) => !open)}
          disabled={disabled}
          className={cn(
            'config-select-trigger w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150 flex items-center justify-between',
            disabled
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              : 'border-gray-300 bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 cursor-pointer'
          )}
        >
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{selectedOption.label}</div>
            {selectedOption.creditsPerSecondLabel && (
              <div className="mt-0.5 text-xs text-gray-500 truncate">
                {selectedOption.creditsPerSecondLabel}
              </div>
            )}
          </div>
          <div className={cn('w-4 h-4 flex items-center justify-center transition-transform duration-150', isOpen && 'rotate-180')}>
            <ChevronDown className="h-3 w-3 text-gray-600" />
          </div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={optionsRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="absolute left-0 right-0 mt-1 overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg z-[9999]"
            >
              {qualityOptions.map((option) => {
                const isSelected = option.value === normalizedSelectedQuality;
                const isOptionDisabled = Boolean(disabled || option.disabled);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      if (isOptionDisabled) return;
                      onQualityChange(option.value);
                      setIsOpen(false);
                    }}
                    disabled={isOptionDisabled}
                    className={cn(
                      'w-full border-b border-gray-100 last:border-b-0 px-3 py-2.5 text-left text-sm flex items-center justify-between transition-colors duration-150',
                      isOptionDisabled
                        ? 'cursor-not-allowed bg-gray-50 text-gray-400'
                        : isSelected
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-700 hover:bg-gray-50 cursor-pointer'
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{option.label}</div>
                      {option.creditsPerSecondLabel && (
                        <div className="mt-0.5 text-xs text-gray-500">{option.creditsPerSecondLabel}</div>
                      )}
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      {option.disabledReason && (
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500"
                          title={option.disabledReason}
                          aria-label={option.disabledReason}
                        >
                          <CircleHelp className="h-3 w-3" />
                        </span>
                      )}
                      {option.disabled ? (
                        <Lock className="h-4 w-4 text-gray-400" />
                      ) : isSelected ? (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-black text-white">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
