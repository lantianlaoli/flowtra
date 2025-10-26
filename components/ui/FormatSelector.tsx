'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OutputMode } from './OutputModeToggle';

// Image format types (aspect ratios for images)
export type ImageFormat = '1:1' | '3:4' | '4:3';

// Video format types (aspect ratios for videos)
export type VideoFormat = '1:1' | '9:16' | '16:9';

// Combined format type
export type Format = ImageFormat | VideoFormat;

interface FormatOption {
  value: Format;
  label: string;
  description: string;
  icon: string;
}

interface FormatSelectorProps {
  outputMode: OutputMode;
  selectedFormat: Format;
  onFormatChange: (format: Format) => void;
  label?: string;
  className?: string;
}

// Format options for image mode
const IMAGE_FORMATS: FormatOption[] = [
  { value: '1:1', label: 'Square', description: '1:1 ratio', icon: '⬜' },
  { value: '3:4', label: 'Portrait', description: '3:4 ratio', icon: '📱' },
  { value: '4:3', label: 'Landscape', description: '4:3 ratio', icon: '🖥️' },
];

// Format options for video mode
const VIDEO_FORMATS: FormatOption[] = [
  { value: '1:1', label: 'Square', description: '1:1 ratio', icon: '⬜' },
  { value: '9:16', label: 'Portrait', description: '9:16 ratio', icon: '📱' },
  { value: '16:9', label: 'Landscape', description: '16:9 ratio', icon: '🖥️' },
];

export default function FormatSelector({
  outputMode,
  selectedFormat,
  onFormatChange,
  label = 'Format',
  className
}: FormatSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Get format options based on output mode
  const formatOptions = outputMode === 'image' ? IMAGE_FORMATS : VIDEO_FORMATS;

  // Validate and auto-correct format when output mode changes
  useEffect(() => {
    const validFormats = formatOptions.map(opt => opt.value);
    if (!validFormats.includes(selectedFormat as Format)) {
      // Auto-select first format if current format is invalid
      onFormatChange(formatOptions[0].value);
    }
  }, [outputMode, selectedFormat, formatOptions, onFormatChange]);

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
            <span className="text-base">{selectedOption.icon}</span>
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
              {formatOptions.map((option) => (
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
                    <span className="text-base">{option.icon}</span>
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
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
