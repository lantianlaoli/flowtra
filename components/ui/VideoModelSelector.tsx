'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Lock, Coins, Video, Clock, Zap, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CREDIT_COSTS,
  canAffordModel,
  getAutoModeSelection,
  getProcessingTime,
  getModelCostByConfig,
  isFreeGenerationModel,
  MODEL_CAPABILITIES,
  type VideoQuality,
  type VideoDuration
} from '@/lib/constants';

interface VideoModelSelectorProps {
  credits: number;
  selectedModel: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok';
  onModelChange: (model: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok') => void;
  // NEW: Top-level quality and duration filters (optional for backwards compatibility)
  videoQuality?: VideoQuality;
  videoDuration?: VideoDuration;
  label?: string;
  className?: string;
  showIcon?: boolean;
  hideCredits?: boolean;
  disabledModels?: Array<'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok'>;
  hiddenModels?: Array<'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok'>;
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
  const [tooltipData, setTooltipData] = useState<{ text: string; left: number; top: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Model options with NEW PRICING (generation-time billing, downloads are FREE)
  const modelOptions = useMemo(() => {
    const autoSelection = getAutoModeSelection(credits);

    // Helper function to calculate duration-based cost for character ads
    const calculateDurationCost = (model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok'): number => {
      if (!videoDurationSeconds) {
        // Use new config-based cost calculation (if quality/duration provided)
        if (videoQuality && videoDuration) {
          return getModelCostByConfig(model, videoQuality, videoDuration);
        }
        // Fallback to base cost if no config provided
        return CREDIT_COSTS[model as keyof typeof CREDIT_COSTS] || 0;
      }
      // Legacy character ads duration-based cost
      const unitSeconds =
        model === 'sora2' || model === 'sora2_pro'
          ? 10
          : model === 'grok'
            ? 6
            : 8;
      const baseCost = CREDIT_COSTS[model as keyof typeof CREDIT_COSTS] || 0;
      return Math.round((videoDurationSeconds / unitSeconds) * baseCost);
    };

    // Check if model is supported by current quality config or disabledModels list
    const isModelSupported = (model: 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok') => {
      // First check disabledModels prop (takes precedence)
      if (disabledModels.includes(model)) {
        return false;
      }
      // Model selection should not be affected by duration
      // Only check quality support
      if (videoQuality) {
        const capability = MODEL_CAPABILITIES.find(cap => cap.model === model);
        if (!capability) return false;
        return capability.supportedQualities.includes(videoQuality);
      }
      // If no constraints, all models are supported
      return true;
    };

    return [
      {
        value: 'auto',
        label: 'Auto',
        description: 'Smart model selection',
        cost: autoSelection ? calculateDurationCost(autoSelection) : CREDIT_COSTS.sora2,
        processingTime: autoSelection ? getProcessingTime(autoSelection) : '2-3 min',
        affordable: canAffordModel(credits, 'auto'),
        features: 'Cheapest available model',
        supported: true // Auto always available
      },
      {
        value: 'sora2',
        label: 'Sora2',
        description: '',
        cost: calculateDurationCost('sora2'),
        processingTime: getProcessingTime('sora2'),
        affordable: canAffordModel(credits, 'sora2'),
        features: 'Budget-friendly, 8-12 min',
        supported: isModelSupported('sora2')
      },
      {
        value: 'veo3_fast',
        label: 'VEO3 Fast',
        description: '',
        cost: calculateDurationCost('veo3_fast'),
        processingTime: getProcessingTime('veo3_fast'),
        affordable: canAffordModel(credits, 'veo3_fast'),
        features: 'Fast processing, 2-3 min',
        supported: isModelSupported('veo3_fast')
      },
      {
        value: 'grok',
        label: 'Grok',
        description: '',
        cost: calculateDurationCost('grok'),
        processingTime: getProcessingTime('grok'),
        affordable: canAffordModel(credits, 'grok'),
        features: '6s segments, up to 60s',
        supported: isModelSupported('grok')
      },
      {
        value: 'sora2_pro',
        label: 'Sora2 Pro',
        description: '',
        cost: calculateDurationCost('sora2_pro'),
        processingTime: getProcessingTime('sora2_pro'),
        affordable: credits >= calculateDurationCost('sora2_pro'),
        features: videoQuality && videoDuration
          ? `${videoQuality === 'high' ? 'HD' : 'Standard'} ${videoDuration}s, 8-15 min`
          : 'Premium quality, 8-15 min',
        supported: isModelSupported('sora2_pro')
      },
      {
        value: 'veo3',
        label: 'VEO3 High',
        description: '',
        cost: calculateDurationCost('veo3'),
        processingTime: getProcessingTime('veo3'),
        affordable: canAffordModel(credits, 'veo3'),
        features: 'Premium quality, 5-8 min',
        supported: isModelSupported('veo3')
      },
    ];
  }, [credits, videoDurationSeconds, videoQuality, videoDuration, disabledModels]);

  const visibleOptions = useMemo(
    () =>
      modelOptions.filter(
        (option) => !hiddenModels?.includes(option.value as 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok')
      ),
    [modelOptions, hiddenModels]
  );

  useEffect(() => {
    if (hiddenModels?.includes(selectedModel)) {
      const fallback = visibleOptions[0];
      if (fallback && fallback.value !== selectedModel) {
        onModelChange(fallback.value as 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok');
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

  const handleOptionSelect = (value: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok', affordable: boolean) => {
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
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">
                {selectedOption?.label}
              </span>
              {selectedOption?.value === 'grok' && (
                <span className="inline-flex items-center text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  Kids Friendly
                </span>
              )}
            </div>
            {selectedOption?.features && (
              <span className="text-xs text-gray-500 truncate">{selectedOption?.features}</span>
            )}
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
              const disabledByConstraint = disabledModels.includes(option.value as 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok');
              const disabledByConfig = !option.supported; // NEW: Disable if not supported by quality/duration
              const isDisabled = !option.affordable || disabledByConstraint || disabledByConfig;
              return (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value as 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok', !isDisabled)}
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
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">
                        {option.label}
                      </span>
                      {option.value === 'grok' && (
                        <span className="inline-flex items-center text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          Kids Friendly
                        </span>
                      )}
                      {option.description && (
                        <div className="relative">
                          <HelpCircle
                            className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600 cursor-help transition-colors"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipData({
                                text: option.description,
                                left: rect.right + 8,
                                top: rect.top - 4
                              });
                            }}
                            onMouseLeave={() => setTooltipData(null)}
                          />
                        </div>
                      )}
                    </div>
                    {isDisabled && (
                      <Lock className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                  {option.features && (
                    <span className="text-xs text-gray-600 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {option.features}
                    </span>
                  )}
                  {!hideCredits && (() => {
                    const model = option.value as 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'auto' | 'grok';
                    const isFreeGen = model !== 'auto' && isFreeGenerationModel(model);

                    return (
                      <div className="flex items-center gap-3 text-xs mt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500">{isFreeGen ? 'Download:' : 'Generation:'}</span>
                          <div className={cn(
                            "flex items-center gap-1 font-semibold",
                            !isDisabled ? "text-gray-900" : "text-red-500"
                          )}>
                            <Coins className="w-3.5 h-3.5" />
                            <span>{option.cost * adsCount}</span>
                          </div>
                        </div>
                        <div className={cn(
                          "flex items-center gap-1",
                          isFreeGen ? "text-green-700" : "text-blue-700"
                        )}>
                          <Zap className="w-3 h-3" />
                          <span className="font-medium">{isFreeGen ? 'Generation FREE' : 'Download FREE'}</span>
                        </div>
                      </div>
                    );
                  })()}
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

      {/* Fixed position tooltip */}
      {tooltipData && (
        <div
          className="fixed w-72 p-3 bg-gray-900 text-white text-xs rounded-md shadow-xl z-[10001] pointer-events-none whitespace-normal leading-relaxed"
          style={{
            left: `${tooltipData.left}px`,
            top: `${tooltipData.top}px`,
          }}
        >
          {tooltipData.text}
          <div className="absolute right-full top-3 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"></div>
        </div>
      )}
    </>
  );
}
