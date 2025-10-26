'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isFreeGenerationModel,
  type VideoQuality,
  type VideoDuration,
  type VideoModel
} from '@/lib/constants';

export interface VideoConfiguration {
  model: VideoModel;
  quality: VideoQuality;
  duration: VideoDuration;
}

interface VideoConfigurationOption extends VideoConfiguration {
  id: string;
  label: string;
  description: string;
  cost: number;
  processingTime: string;
  features: string;
}

interface VideoConfigurationSelectorProps {
  credits: number;
  selectedConfig: VideoConfiguration;
  onConfigChange: (config: VideoConfiguration) => void;
  label?: string;
  className?: string;
  showIcon?: boolean;
  adsCount?: number;
}

// Define all available video configuration presets
const VIDEO_CONFIGURATION_PRESETS: VideoConfigurationOption[] = [
  {
    id: 'veo3_fast_8s_standard',
    model: 'veo3_fast',
    quality: 'standard',
    duration: '8',
    label: 'Veo3 Fast - 8s Standard',
    description: 'Fast generation, good quality',
    cost: 20,
    processingTime: '2-3 min',
    features: 'Quick turnaround'
  },
  {
    id: 'veo3_8s_standard',
    model: 'veo3',
    quality: 'standard',
    duration: '8',
    label: 'Veo3 - 8s Standard',
    description: 'Premium quality, standard length',
    cost: 150,
    processingTime: '5-8 min',
    features: 'High quality output'
  },
  {
    id: 'sora2_10s_standard',
    model: 'sora2',
    quality: 'standard',
    duration: '10',
    label: 'Sora2 - 10s Standard',
    description: 'Budget-friendly, extended length',
    cost: 6,
    processingTime: '8-12 min',
    features: 'Most economical'
  },
  {
    id: 'sora2_pro_10s_standard',
    model: 'sora2_pro',
    quality: 'standard',
    duration: '10',
    label: 'Sora2 Pro - 10s Standard',
    description: 'Professional quality, standard definition',
    cost: 36,
    processingTime: '8-15 min',
    features: 'Pro features'
  },
  {
    id: 'sora2_pro_10s_hd',
    model: 'sora2_pro',
    quality: 'high',
    duration: '10',
    label: 'Sora2 Pro - 10s HD',
    description: 'Professional quality, high definition',
    cost: 80,
    processingTime: '8-15 min',
    features: 'HD quality'
  },
  {
    id: 'sora2_pro_15s_standard',
    model: 'sora2_pro',
    quality: 'standard',
    duration: '15',
    label: 'Sora2 Pro - 15s Standard',
    description: 'Professional quality, extended length',
    cost: 54,
    processingTime: '8-15 min',
    features: 'Extended duration'
  },
  {
    id: 'sora2_pro_15s_hd',
    model: 'sora2_pro',
    quality: 'high',
    duration: '15',
    label: 'Sora2 Pro - 15s HD',
    description: 'Professional quality, extended HD',
    cost: 160,
    processingTime: '8-15 min',
    features: 'Premium HD'
  }
];

export default function VideoConfigurationSelector({
  credits,
  selectedConfig,
  onConfigChange,
  label = 'Video Configuration',
  className,
  showIcon = false,
  adsCount = 1
}: VideoConfigurationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

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

  // Find the currently selected option
  const selectedOption = useMemo(() => {
    return VIDEO_CONFIGURATION_PRESETS.find(
      opt =>
        opt.model === selectedConfig.model &&
        opt.quality === selectedConfig.quality &&
        opt.duration === selectedConfig.duration
    ) || VIDEO_CONFIGURATION_PRESETS[0];
  }, [selectedConfig]);

  const handleOptionSelect = (option: VideoConfigurationOption) => {
    const totalCost = option.cost * adsCount;
    const canAfford = credits >= totalCost;

    if (!canAfford) return;

    onConfigChange({
      model: option.model,
      quality: option.quality,
      duration: option.duration
    });

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('flowtra_video_config', JSON.stringify({
          model: option.model,
          quality: option.quality,
          duration: option.duration
        }));
      }
    } catch {}

    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        {showIcon && <Sparkles className="w-4 h-4" />}
        {label}
      </label>
      <div className="relative">
        {/* Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-md transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
        >
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="font-medium truncate">
              {selectedOption.label}
            </span>
            <span className="text-xs text-gray-500 truncate">
              {selectedOption.description}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-600">
              {(() => {
                const isFreeGen = isFreeGenerationModel(selectedOption.model);
                const totalCost = selectedOption.cost * adsCount;
                return (
                  <>
                    <span>Generation: {isFreeGen ? 'FREE' : `${totalCost} credits`}</span>
                    <span>•</span>
                    <span>Download: {isFreeGen ? `${totalCost} credits` : 'FREE'}</span>
                  </>
                );
              })()}
            </div>
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
              className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-[9999] max-h-[400px] overflow-y-auto"
            >
              {VIDEO_CONFIGURATION_PRESETS.map((option) => {
                const totalCost = option.cost * adsCount;
                const isAffordable = credits >= totalCost;
                const isSelected = option.id === selectedOption.id;
                const isFreeGen = isFreeGenerationModel(option.model);

                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionSelect(option)}
                    disabled={!isAffordable}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between border-b border-gray-100 last:border-b-0",
                      !isAffordable
                        ? "cursor-not-allowed opacity-50 bg-gray-50"
                        : "hover:bg-gray-100 cursor-pointer",
                      isSelected
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-700"
                    )}
                  >
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{option.label}</span>
                        {!isAffordable && (
                          <Lock className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {option.description}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs mt-0.5">
                        <span className={cn(
                          "font-medium",
                          !isAffordable ? "text-red-500" : "text-gray-700"
                        )}>
                          Generation: {isFreeGen ? 'FREE' : `${totalCost} credits`}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-600">
                          Download: {isFreeGen ? `${totalCost} credits` : 'FREE'}
                        </span>
                      </div>
                    </div>
                    {isSelected && isAffordable && (
                      <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
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
