'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Maximize2, Square, Smartphone, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OutputMode } from './OutputModeToggle';
import type { LucideIcon } from 'lucide-react';

// Image format types for nano_banana (aspect ratios)
export type NanoBananaFormat = '1:1' | '9:16' | '16:9' | '3:4' | '4:3' | '3:2' | '2:3' | '5:4' | '4:5' | '21:9' | 'auto';

// Image format types for seedream (descriptive formats)
export type SeedreamFormat = 'square' | 'square_hd' | 'portrait_4_3' | 'portrait_3_2' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_3_2' | 'landscape_16_9' | 'landscape_21_9';

// Video format types (aspect ratios for videos)
export type VideoFormat = '1:1' | '9:16' | '16:9';

// Combined format type
export type Format = NanoBananaFormat | SeedreamFormat | VideoFormat;

interface FormatOption {
  value: Format;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface FormatSelectorProps {
  outputMode: OutputMode;
  selectedFormat: Format;
  onFormatChange: (format: Format) => void;
  label?: string;
  className?: string;
  imageModel?: 'nano_banana' | 'seedream';
}

// Format options for image mode - nano_banana
const NANO_BANANA_FORMATS: FormatOption[] = [
  { value: '1:1', label: 'Square', description: '1:1 ratio', icon: Square },
  { value: '9:16', label: 'Portrait', description: '9:16 ratio', icon: Smartphone },
  { value: '16:9', label: 'Landscape', description: '16:9 ratio', icon: Monitor },
  { value: '3:4', label: 'Portrait', description: '3:4 ratio', icon: Smartphone },
  { value: '4:3', label: 'Landscape', description: '4:3 ratio', icon: Monitor },
  { value: '3:2', label: 'Landscape', description: '3:2 ratio', icon: Monitor },
  { value: '2:3', label: 'Portrait', description: '2:3 ratio', icon: Smartphone },
  { value: '5:4', label: 'Landscape', description: '5:4 ratio', icon: Monitor },
  { value: '4:5', label: 'Portrait', description: '4:5 ratio', icon: Smartphone },
  { value: '21:9', label: 'Ultra Wide', description: '21:9 ratio', icon: Monitor },
  { value: 'auto', label: 'Auto', description: 'Auto detect', icon: Maximize2 },
];

// Format options for image mode - seedream
const SEEDREAM_FORMATS: FormatOption[] = [
  { value: 'square', label: 'Square', description: 'Standard square', icon: Square },
  { value: 'square_hd', label: 'Square HD', description: 'High quality square', icon: Square },
  { value: 'portrait_4_3', label: 'Portrait 3:4', description: '3:4 ratio', icon: Smartphone },
  { value: 'portrait_3_2', label: 'Portrait 2:3', description: '2:3 ratio', icon: Smartphone },
  { value: 'portrait_16_9', label: 'Portrait 9:16', description: '9:16 ratio', icon: Smartphone },
  { value: 'landscape_4_3', label: 'Landscape 4:3', description: '4:3 ratio', icon: Monitor },
  { value: 'landscape_3_2', label: 'Landscape 3:2', description: '3:2 ratio', icon: Monitor },
  { value: 'landscape_16_9', label: 'Landscape 16:9', description: '16:9 ratio', icon: Monitor },
  { value: 'landscape_21_9', label: 'Landscape 21:9', description: '21:9 ratio', icon: Monitor },
];

// Format options for video mode (only 16:9 and 9:16 supported)
const VIDEO_FORMATS: FormatOption[] = [
  { value: '9:16', label: 'Portrait', description: '9:16 ratio', icon: Smartphone },
  { value: '16:9', label: 'Landscape', description: '16:9 ratio', icon: Monitor },
];

export default function FormatSelector({
  outputMode,
  selectedFormat,
  onFormatChange,
  label = 'Format',
  className,
  imageModel = 'nano_banana'
}: FormatSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Get format options based on output mode and image model
  const formatOptions = outputMode === 'image'
    ? (imageModel === 'seedream' ? SEEDREAM_FORMATS : NANO_BANANA_FORMATS)
    : VIDEO_FORMATS;

  // Validate and auto-correct format when output mode or image model changes
  useEffect(() => {
    const validFormats = formatOptions.map(opt => opt.value);
    if (!validFormats.includes(selectedFormat as Format)) {
      // Auto-select first format if current format is invalid
      onFormatChange(formatOptions[0].value);
    }
  }, [outputMode, imageModel, selectedFormat, formatOptions, onFormatChange]);

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

  const selectedOption = formatOptions.find(opt => opt.value === selectedFormat) || formatOptions[0];

  const handleOptionSelect = (value: Format) => {
    onFormatChange(value);
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        <Maximize2 className="w-4 h-4" />
        {label}
      </label>
      <div className="relative">
        {/* Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-md transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <selectedOption.icon className="w-4 h-4 text-gray-600" />
            <div className="flex flex-col">
              <span className="font-medium">{selectedOption.label}</span>
              <span className="text-xs text-gray-500">{selectedOption.description}</span>
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
              className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-[9999] overflow-hidden"
            >
              {formatOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleOptionSelect(option.value)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 cursor-pointer",
                      selectedFormat === option.value
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-700"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <IconComponent className="w-4 h-4 text-gray-600" />
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-gray-500">{option.description}</span>
                      </div>
                    </div>
                    {selectedFormat === option.value && (
                      <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center">
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
