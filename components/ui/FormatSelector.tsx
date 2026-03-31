'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Maximize2, Square, Smartphone, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type OutputMode = 'video' | 'image';

export type ImageFormat = '1:1' | '9:16' | '16:9' | '3:4' | '4:3' | '3:2' | '2:3' | '5:4' | '4:5' | '21:9';

// Video format types (aspect ratios for videos)
export type VideoFormat = '1:1' | '9:16' | '16:9';

// Combined format type
export type Format = ImageFormat | VideoFormat;

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
  disabled?: boolean;
}

const IMAGE_FORMATS: FormatOption[] = [
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
  disabled = false
}: FormatSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

  // Set mounted state to prevent hydration issues with portal
  useEffect(() => {
    setMounted(true);
  }, []);

  const formatOptions = outputMode === 'image' ? IMAGE_FORMATS : VIDEO_FORMATS;

  // Validate and auto-correct format when output mode changes
  useEffect(() => {
    const validFormats = formatOptions.map(opt => opt.value);
    if (!validFormats.includes(selectedFormat as Format)) {
      // Auto-select first format if current format is invalid
      onFormatChange(formatOptions[0].value);
    }
  }, [outputMode, selectedFormat, formatOptions, onFormatChange]);

  // Update button position when opening dropdown
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        optionsRef.current &&
        !optionsRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);


  const selectedOption = formatOptions.find(opt => opt.value === selectedFormat) || formatOptions[0];

  const handleOptionSelect = (value: Format) => {
    onFormatChange(value);
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      <label className="config-field-label flex items-center gap-2 text-base font-medium text-gray-900">
        <Maximize2 className="w-4 h-4" />
        {label}
      </label>
      <div className="relative">
        {/* Dropdown Button */}
        <button
          ref={buttonRef}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "config-select-trigger w-full px-3 py-2 text-sm border rounded-lg transition-colors duration-150 text-gray-900 text-left flex items-center justify-between",
            disabled
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
              : 'bg-white border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 cursor-pointer'
          )}
        >
          <div className="flex items-center gap-2">
            <selectedOption.icon className="config-select-icon w-4 h-4 text-gray-600" />
            <div className="flex flex-col">
              <span className="font-medium">{selectedOption.label}</span>
              <span className="config-select-meta text-xs text-gray-500">{selectedOption.description}</span>
            </div>
          </div>
          <div className={`w-4 h-4 flex items-center justify-center transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="config-select-icon h-3 w-3 text-gray-600" />
          </div>
        </button>

        {/* Dropdown Options - Portal to body */}
        {mounted && isOpen && !disabled && buttonRect && typeof window !== 'undefined' && createPortal(
          <AnimatePresence>
            <motion.div
              ref={optionsRef}
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{
                position: 'fixed',
                left: `${buttonRect.left}px`,
                top: `${buttonRect.bottom + 4}px`,
                width: `${buttonRect.width}px`,
              }}
              className="config-select-panel bg-white border border-gray-300 rounded-lg shadow-lg z-[9999] overflow-hidden"
            >
              {formatOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleOptionSelect(option.value)}
                    className={cn(
                      "config-select-option w-full px-3 py-2 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 cursor-pointer",
                      selectedFormat === option.value
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-700"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <IconComponent className="config-select-icon w-4 h-4 text-gray-600" />
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="config-select-meta text-xs text-gray-500">{option.description}</span>
                      </div>
                    </div>
                    {selectedFormat === option.value && (
                      <div className="config-select-check w-4 h-4 bg-black rounded-sm flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
      </div>
    </div>
  );
}
