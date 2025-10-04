"use client";

import { useEffect, useRef, useState } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AccentType = 'australian' | 'american' | 'british' | 'canadian' | 'irish' | 'south_african';

interface AccentOption {
  value: AccentType;
  label: string;
  description: string;
  flag: string;
}

interface AccentSelectorProps {
  selectedAccent: AccentType;
  onAccentChange: (accent: AccentType) => void;
  showIcon?: boolean;
  label?: string;
  className?: string;
}

const accentOptions: AccentOption[] = [
  {
    value: 'australian',
    label: 'Australian',
    description: 'Warm, friendly Australian accent',
    flag: '🇦🇺'
  },
  {
    value: 'american',
    label: 'American',
    description: 'Clear, professional American accent',
    flag: '🇺🇸'
  },
  {
    value: 'british',
    label: 'British',
    description: 'Sophisticated British accent',
    flag: '🇬🇧'
  },
  {
    value: 'canadian',
    label: 'Canadian',
    description: 'Friendly, approachable Canadian accent',
    flag: '🇨🇦'
  },
  {
    value: 'irish',
    label: 'Irish',
    description: 'Charming, melodic Irish accent',
    flag: '🇮🇪'
  },
  {
    value: 'south_african',
    label: 'South African',
    description: 'Distinctive South African accent',
    flag: '🇿🇦'
  }
];

export default function AccentSelector({
  selectedAccent,
  onAccentChange,
  showIcon = false,
  label = 'Voice Accent',
  className
}: AccentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const selectedOption = accentOptions.find((option) => option.value === selectedAccent);

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

  const handleOptionSelect = (value: AccentType) => {
    onAccentChange(value);
    setIsOpen(false);
  };

  return (
    <div className={cn('space-y-3', className)} ref={dropdownRef}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        {showIcon && <Globe className="w-4 h-4" />}
        {label}
      </label>
      <div className="relative">
        {/* Custom Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-md transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base leading-none">{selectedOption?.flag}</span>
            <div className="min-w-0">
              <div className="font-medium truncate">{selectedOption?.label}</div>
              {/* Put the description inline within the control for context */}
              {selectedOption?.description && (
                <div className="text-xs text-gray-500 truncate">{selectedOption.description}</div>
              )}
            </div>
          </div>
          <div className={`w-4 h-4 flex items-center justify-center transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-3 w-3 text-gray-600" />
          </div>
        </button>

        {/* Custom Dropdown Options */}
        {isOpen && (
          <div
            ref={optionsRef}
            className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md overflow-hidden z-50 shadow-lg"
          >
            {accentOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value)}
                className={cn(
                  'w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0',
                  selectedAccent === option.value ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base leading-none">{option.flag}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{option.label}</div>
                      <div className="text-xs text-gray-600 truncate">{option.description}</div>
                    </div>
                  </div>
                  {selectedAccent === option.value && (
                    <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2 flex-shrink-0">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
