'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Globe, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUPPORTED_LANGUAGE_CODES, type LanguageCode } from '@/lib/constants';
import { useI18n } from '@/providers/I18nProvider';
export type { LanguageCode } from '@/lib/constants';

interface LanguageSelectorProps {
  selectedLanguage: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
  label?: string;
  className?: string;
  showIcon?: boolean;
  recommendedLanguage?: LanguageCode | null;
}

const LANGUAGE_OPTIONS: Array<{
  value: LanguageCode;
  flag: string;
}> = [
  { value: 'en', flag: '🇺🇸' },
  { value: 'zh', flag: '🇨🇳' },
  { value: 'zh_yue', flag: '🇨🇳' },
  { value: 'ja', flag: '🇯🇵' },
  { value: 'ko', flag: '🇰🇷' },
  { value: 'es', flag: '🇪🇸' },
  { value: 'fr', flag: '🇫🇷' },
  { value: 'de', flag: '🇩🇪' },
  { value: 'pt', flag: '🇵🇹' },
];

export default function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  label = 'Language',
  className,
  showIcon = false,
  recommendedLanguage = null,
}: LanguageSelectorProps) {
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const localizedLanguageNames = useMemo<Record<LanguageCode, string>>(() => (
    locale === 'zh'
      ? {
          en: '英语',
          zh: '中文',
          zh_yue: '粤语',
          ja: '日语',
          ko: '韩语',
          es: '西班牙语',
          fr: '法语',
          de: '德语',
          pt: '葡萄牙语',
        }
      : {
          en: 'English',
          zh: 'Chinese',
          zh_yue: 'Cantonese',
          ja: 'Japanese',
          ko: 'Korean',
          es: 'Spanish',
          fr: 'French',
          de: 'German',
          pt: 'Portuguese',
        }
  ), [locale]);

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

  const normalizedRecommendedLanguage = useMemo(() => {
    if (!recommendedLanguage) return null;
    return SUPPORTED_LANGUAGE_CODES.includes(recommendedLanguage) ? recommendedLanguage : null;
  }, [recommendedLanguage]);

  const orderedOptions = useMemo(() => {
    if (!normalizedRecommendedLanguage) {
      return LANGUAGE_OPTIONS;
    }

    const recommendedOption = LANGUAGE_OPTIONS.find((option) => option.value === normalizedRecommendedLanguage);
    if (!recommendedOption) {
      return LANGUAGE_OPTIONS;
    }

    return [
      recommendedOption,
      ...LANGUAGE_OPTIONS.filter((option) => option.value !== normalizedRecommendedLanguage)
    ];
  }, [normalizedRecommendedLanguage]);

  const selectedOption = orderedOptions.find(opt => opt.value === selectedLanguage) || orderedOptions[0];
  const selectedLabel = localizedLanguageNames[selectedLanguage];
  const selectedFlag = LANGUAGE_OPTIONS.find((option) => option.value === selectedLanguage)?.flag || selectedOption?.flag;
  const selectedIsRecommended = normalizedRecommendedLanguage === selectedLanguage;

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
              {selectedFlag}
            </span>
            <span className="font-medium truncate">
              {selectedLabel}
            </span>
            {selectedIsRecommended ? (
              <span className="config-select-recommend inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                <Sparkles className="w-3 h-3" />
                Recommended
              </span>
            ) : null}
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
              {orderedOptions.map((option) => (
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
                      {localizedLanguageNames[option.value]}
                    </span>
                    {normalizedRecommendedLanguage === option.value ? (
                      <span className="config-select-recommend inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                        <Sparkles className="w-3 h-3" />
                        Recommended
                      </span>
                    ) : null}
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
