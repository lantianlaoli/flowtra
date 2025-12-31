'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Lock, Coins, Video, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  GENERATION_COSTS,
  canAffordModel,
  getProcessingTime,
  getModelCostByConfig,
  getVideoModelDisplayName,
  type VideoQuality,
  type VideoDuration,
  type VideoModel
} from '@/lib/constants';

interface VideoModelSelectorProps {
  credits: number;
  selectedModel: VideoModel;
  onModelChange: (model: VideoModel) => void;
  videoQuality?: VideoQuality;
  videoDuration?: VideoDuration;
  label?: string;
  className?: string;
  showIcon?: boolean;
  hideCredits?: boolean;
  disabledModels?: VideoModel[];
  hiddenModels?: VideoModel[];
  adsCount?: number;
  videoDurationSeconds?: number;
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
      // Character ads duration-based cost (all veo3 models use 8s segments)
      const unitSeconds = 8;
      const baseCost = GENERATION_COSTS[model] || 0;
      return Math.round((videoDurationSeconds / unitSeconds) * baseCost);
    };

    // Check if model is supported by current quality config or disabledModels list
    const isModelSupported = (model: VideoModel) => {
      // First check disabledModels prop (takes precedence)
      if (disabledModels.includes(model)) {
        return false;
      }
      // All veo3 models support 'standard' quality only
      return true;
    };

    return [
      {
        value: 'veo3_fast' as const,
        label: getVideoModelDisplayName('veo3_fast'),
        description: 'Fast generation, balanced quality',
        cost: calculateDurationCost('veo3_fast'),
        processingTime: getProcessingTime('veo3_fast'),
        affordable: canAffordModel(credits, 'veo3_fast'),
        features: 'Fast processing, 2-3 min',
        supported: isModelSupported('veo3_fast'),
        badge: 'Popular'
      },
      {
        value: 'seedance_1_5_pro' as const,
        label: getVideoModelDisplayName('seedance_1_5_pro'),
        description: 'ByteDance model with audio',
        cost: calculateDurationCost('seedance_1_5_pro'),
        processingTime: getProcessingTime('seedance_1_5_pro'),
        affordable: canAffordModel(credits, 'seedance_1_5_pro'),
        features: 'Built-in audio, 1-2 min',
        supported: isModelSupported('seedance_1_5_pro'),
        badge: 'Audio'
      },
      {
        value: 'veo3' as const,
        label: getVideoModelDisplayName('veo3'),
        description: 'Premium quality generation',
        cost: calculateDurationCost('veo3'),
        processingTime: getProcessingTime('veo3'),
        affordable: canAffordModel(credits, 'veo3'),
        features: 'Premium quality, 5-8 min',
        supported: isModelSupported('veo3'),
        badge: 'Premium'
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
        <label className="flex items-center gap-2 text-base font-medium text-gray-900">
          {showIcon && <Video className="w-4 h-4" />}
          {label}
        </label>
      <div className="relative">
        {/* Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-md transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
        >
          <div className="min-w-0">
            <span className="font-medium truncate">
              {selectedOption?.label}
            </span>
          </div>
          <div className={`w-4 h-4 flex items-center justify-center transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-3 w-3 text-gray-600" />
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
            className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-[9999] max-h-[280px] overflow-y-auto"
          >
            {visibleOptions.map((option) => {
              const disabledByConstraint = disabledModels.includes(option.value);
              const disabledByConfig = !option.supported; // NEW: Disable if not supported by quality/duration
              const isDisabled = !option.affordable || disabledByConstraint || disabledByConfig;
              return (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value, !isDisabled)}
                disabled={isDisabled}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors duration-150 flex items-center justify-between",
                  isDisabled
                    ? "cursor-not-allowed opacity-50 bg-gray-50"
                    : "hover:bg-gray-100 cursor-pointer",
                  selectedModel === option.value
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700"
                )}
              >
                <div className="flex flex-1 items-center gap-2">
                  <span className="font-medium">
                    {option.label}
                  </span>
                  {isDisabled && (
                    <Lock className="w-3 h-3 text-gray-400" />
                  )}
                </div>
                {selectedModel === option.value && !isDisabled && (
                  <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2">
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
