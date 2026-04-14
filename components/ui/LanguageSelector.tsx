'use client';

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LanguageCode } from '@/lib/constants';
export type { LanguageCode } from '@/lib/constants';

interface LanguageSelectorProps {
  selectedLanguage: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

const LANGUAGE_OPTIONS: Array<{
  value: LanguageCode;
  label: string;
  nativeName: string;
  flag: string;
}> = [
  { value: 'en', label: 'English', nativeName: 'English', flag: '🇺🇸' },
  { value: 'zh', label: 'Chinese (Mandarin)', nativeName: '中文（普通话）', flag: '🇨🇳' },
  { value: 'ja', label: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { value: 'ko', label: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { value: 'es', label: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { value: 'fr', label: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { value: 'de', label: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { value: 'pt', label: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
];

export default function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  label = 'Language',
  className,
  showIcon = false,
}: LanguageSelectorProps) {
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

  const selectedOption = LANGUAGE_OPTIONS.find(opt => opt.value === selectedLanguage) || LANGUAGE_OPTIONS[0];

  const handleOptionSelect = (value: LanguageCode) => {
    onLanguageChange(value);
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      <label className="config-field-label flex items-center gap-2 text-base font-medium text-gray-900">
        {showIcon && <Globe className="w-4 h-4" />}
        {label}
      </label>
      <div className="relative">
        {/* Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="config-select-trigger w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-lg transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
        >
          <div className="min-w-0 flex items-center gap-2">
            <span
              className="text-base"
              style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji' }}
            >
              {selectedOption?.flag}
            </span>
            <span className="font-medium truncate">
              {selectedOption?.label}
            </span>
            <span className="config-select-meta text-xs text-gray-500 truncate">
              {selectedOption?.nativeName}
            </span>
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
              className="config-select-panel absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[9999] max-h-[300px] overflow-y-auto"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleOptionSelect(option.value)}
                  className={cn(
                    "config-select-option w-full px-3 py-2 text-left text-sm transition-colors duration-150 flex items-center justify-between hover:bg-gray-100 cursor-pointer",
                    selectedLanguage === option.value
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-700"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-base"
                      style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji' }}
                    >
                      {option.flag}
                    </span>
                    <span className="font-medium">
                      {option.label}
                    </span>
                    <span className="config-select-meta text-xs text-gray-500">
                      {option.nativeName}
                    </span>
                  </div>
                  {selectedLanguage === option.value && (
                    <div className="config-select-check w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2">
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
