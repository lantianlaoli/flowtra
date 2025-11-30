'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoQualitySelectorProps {
  selectedQuality: 'standard' | 'high';
  onQualityChange: (quality: 'standard' | 'high') => void;
  label?: string;
  className?: string;
  showIcon?: boolean;
  disabled?: boolean;
  disabledQualities?: Array<'standard' | 'high'>;
}

export default function VideoQualitySelector({
  selectedQuality,
  onQualityChange,
  label = 'Video Quality',
  className,
  showIcon = false,
  disabled = false,
  disabledQualities = []
}: VideoQualitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const qualityOptions = [
    {
      value: 'standard' as const,
      label: '720p',
      description: 'Balanced quality and cost',
      icon: Zap,
      features: 'Fast processing, good quality'
    },
    {
      value: 'high' as const,
      label: '1080p',
      description: 'Premium high-definition',
      icon: Sparkles,
      features: 'Premium quality, longer processing'
    }
  ];

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

  const selectedOption = qualityOptions.find(opt => opt.value === selectedQuality);

  const handleOptionSelect = (value: 'standard' | 'high') => {
    if (disabledQualities.includes(value)) return;
    onQualityChange(value);
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
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "w-full px-3 py-2 text-sm bg-white border rounded-md transition-colors duration-150 text-gray-900 text-left flex items-center justify-between",
            disabled
              ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
              : "border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 cursor-pointer"
          )}
        >
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-2">
              {selectedOption?.icon && (
                <selectedOption.icon className="w-4 h-4 text-gray-500" />
              )}
              <span className="font-medium truncate">
                {selectedOption?.label}
              </span>
            </div>
            {selectedOption?.features && (
              <span className="text-xs text-gray-500 truncate mt-0.5">
                {selectedOption.features}
              </span>
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
            className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-[9999] overflow-hidden"
          >
            {qualityOptions.map((option) => {
              const isDisabled = disabledQualities.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => handleOptionSelect(option.value)}
                  disabled={isDisabled}
                  className={cn(
                    "w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between border-b border-gray-100 last:border-b-0",
                    isDisabled
                      ? "cursor-not-allowed opacity-50 bg-gray-50"
                      : "hover:bg-gray-100 cursor-pointer",
                    selectedQuality === option.value
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-700"
                  )}
                >
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <option.icon className={cn(
                        "w-4 h-4",
                        isDisabled ? "text-gray-400" : "text-gray-500"
                      )} />
                      <span className="font-medium">{option.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {option.description}
                    </span>
                    <span className="text-xs text-gray-600">
                      {option.features}
                    </span>
                  </div>
                  {selectedQuality === option.value && !isDisabled && (
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
