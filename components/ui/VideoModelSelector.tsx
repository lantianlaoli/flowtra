'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Lock, Coins, Video, AlertTriangle } from 'lucide-react';
import { ByteDance, Kling } from '@lobehub/icons';
import { cn } from '@/lib/utils';
import {
  GENERATION_COSTS,
  getProcessingTime,
  getModelCostByConfig,
  getVideoModelDisplayName,
  type PersistedVideoQuality,
  type VideoDuration,
  type VideoModel
} from '@/lib/constants';

interface VideoModelSelectorProps {
  credits: number;
  selectedModel: VideoModel;
  onModelChange: (model: VideoModel) => void;
  videoQuality?: PersistedVideoQuality;
  videoDuration?: VideoDuration;
  label?: string;
  className?: string;
  showIcon?: boolean;
  hideCredits?: boolean;
  disabledModels?: VideoModel[];
  disabledModelReasons?: Partial<Record<VideoModel, string>>;
  hiddenModels?: VideoModel[];
  adsCount?: number;
  videoDurationSeconds?: number;
}

function ModelConstraintBadge({ label }: { label: string }) {
  return (
    <span className="pointer-events-none inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium leading-none text-gray-600">
      <AlertTriangle className="h-3 w-3" />
      <span>{label}</span>
    </span>
  );
}

export default function VideoModelSelector({
  credits,
  selectedModel,
  onModelChange,
  videoQuality,
  videoDuration,
  label = 'Video Model',
  className,
  showIcon = false,
  hideCredits = false,
  disabledModels = [],
  disabledModelReasons = {},
  hiddenModels,
  adsCount = 1,
  videoDurationSeconds
}: VideoModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Model options with Generation-Time Billing (downloads are FREE)
  const modelOptions = useMemo(() => {
    // Helper function to calculate duration-based cost
    const calculateDurationCost = (model: VideoModel): number => {
      if (!videoDurationSeconds) {
        // Use config-based cost calculation (if quality/duration provided)
        if (videoQuality && videoDuration) {
          return getModelCostByConfig(model, videoQuality, videoDuration);
        }
        // Fallback to base cost if no config provided
        return GENERATION_COSTS[model] || 0;
      }
      if (model === 'kling_3' || model === 'seedance_2_fast' || model === 'seedance_2') {
        return Math.ceil(videoDurationSeconds) * (GENERATION_COSTS[model] || 0);
      }
      const baseCost = GENERATION_COSTS[model] || 0;
      return Math.ceil(videoDurationSeconds) * baseCost;
    };

    // Check if model is supported by current quality config or disabledModels list
    const isModelSupported = (model: VideoModel) => {
      // First check disabledModels prop (takes precedence)
      if (disabledModels.includes(model)) {
        return false;
      }
      // Models currently use standard quality handling
      return true;
    };

      return [
      {
        value: 'seedance_2_fast' as const,
        label: getVideoModelDisplayName('seedance_2_fast'),
        description: 'Fast ByteDance generation with native audio',
        icon: ByteDance,
        cost: calculateDurationCost('seedance_2_fast'),
        processingTime: getProcessingTime('seedance_2_fast'),
        affordable: credits >= calculateDurationCost('seedance_2_fast'),
        features: 'Native 720p, 1-2 min',
        supported: isModelSupported('seedance_2_fast'),
        badge: 'Popular'
      },
      {
        value: 'seedance_2' as const,
        label: getVideoModelDisplayName('seedance_2'),
        description: 'Higher-fidelity ByteDance generation',
        icon: ByteDance,
        cost: calculateDurationCost('seedance_2'),
        processingTime: getProcessingTime('seedance_2'),
        affordable: credits >= calculateDurationCost('seedance_2'),
        features: 'Native 720p, richer motion',
        supported: isModelSupported('seedance_2'),
        badge: 'Pro'
      },
      {
        value: 'kling_3' as const,
        label: getVideoModelDisplayName('kling_3'),
        description: 'Resolution-aware audio generation',
        icon: Kling,
        cost: calculateDurationCost('kling_3'),
        processingTime: getProcessingTime('kling_3'),
        affordable: credits >= calculateDurationCost('kling_3'),
        features: '720p std or 1080p pro',
        supported: isModelSupported('kling_3'),
        badge: 'New'
      }
    ];
  }, [credits, videoDurationSeconds, videoQuality, videoDuration, disabledModels]);

  const visibleOptions = useMemo(
    () =>
      modelOptions.filter(
        (option) => !hiddenModels?.includes(option.value)
      ),
    [modelOptions, hiddenModels]
  );

  useEffect(() => {
    if (hiddenModels?.includes(selectedModel)) {
      const fallback = visibleOptions[0];
      if (fallback && fallback.value !== selectedModel) {
        onModelChange(fallback.value);
      }
    }
  }, [hiddenModels, selectedModel, visibleOptions, onModelChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Adjust dropdown position to prevent overflow
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

  const selectedOption = visibleOptions.find(opt => opt.value === selectedModel) || visibleOptions[0];

  const handleOptionSelect = (value: VideoModel, affordable: boolean) => {
    if (!affordable) return;
    onModelChange(value);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('flowtra_video_model', value);
      }
    } catch {}
    setIsOpen(false);
  };

  return (
    <>
      <div className={cn("space-y-3", className)} ref={dropdownRef}>
        <label className="config-field-label flex items-center gap-2 text-base font-medium text-gray-900">
          {showIcon && <Video className="w-4 h-4" />}
          {label}
        </label>
      <div className="relative">
        {/* Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="config-select-trigger w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-lg transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
        >
          <div className="min-w-0 flex items-center gap-2">
            <span className="config-model-icon flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
              <selectedOption.icon className="h-4 w-4 text-gray-700" />
            </span>
            <span className="font-medium truncate">{selectedOption?.label}</span>
            {selectedOption && disabledModels.includes(selectedOption.value) && disabledModelReasons[selectedOption.value] && (
              <ModelConstraintBadge label={disabledModelReasons[selectedOption.value] as string} />
            )}
          </div>
          <div className={`w-4 h-4 flex items-center justify-center transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="config-select-icon h-3 w-3 text-gray-600" />
          </div>
        </button>

        {/* Dropdown Options */}
        <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={optionsRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="config-select-panel absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[9999] max-h-[280px] overflow-y-auto"
          >
            {visibleOptions.map((option) => {
              const disabledByConstraint = disabledModels.includes(option.value);
              const disabledReason = disabledModelReasons[option.value];
              const disabledByConfig = !option.supported; // NEW: Disable if not supported by quality/duration
              const isDisabled = !option.affordable || disabledByConstraint || disabledByConfig;
              return (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value, !isDisabled)}
                disabled={isDisabled}
                className={cn(
                  "config-select-option w-full px-3 py-2 text-left text-sm transition-colors duration-150 flex items-center justify-between",
                  isDisabled
                    ? "cursor-not-allowed opacity-50 bg-gray-50"
                    : "hover:bg-gray-100 cursor-pointer",
                  selectedModel === option.value
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700"
                )}
              >
                <div className="flex flex-1 items-center gap-2">
                  <span className="config-model-icon flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-gray-50">
                    <option.icon className="h-4 w-4 text-gray-700" />
                  </span>
                  <span className="font-medium">{option.label}</span>
                  {disabledByConstraint && disabledReason && (
                    <ModelConstraintBadge label={disabledReason} />
                  )}
                  {isDisabled && (
                    <Lock className="config-select-icon w-3 h-3 text-gray-400" />
                  )}
                </div>
                {selectedModel === option.value && !isDisabled && (
                  <div className="config-select-check w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </button>
            )})}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
    </>
  );
}
