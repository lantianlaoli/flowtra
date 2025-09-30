'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Monitor, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoAspectRatioSelectorProps {
  selectedAspectRatio: '16:9' | '9:16';
  onAspectRatioChange: (aspectRatio: '16:9' | '9:16') => void;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export default function VideoAspectRatioSelector({
  selectedAspectRatio,
  onAspectRatioChange,
  label = 'Video Format',
  className,
  showIcon = false
}: VideoAspectRatioSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Aspect ratio options with detailed platform descriptions
  const aspectRatioOptions = [
    {
      value: '16:9' as const,
      label: 'Landscape',
      subtitle: '16:9',
      description: 'Horizontal widescreen format',
      platforms: 'YouTube videos, desktop ads, TV displays',
      icon: Monitor,
      note: 'Supports 1080P HD quality'
    },
    {
      value: '9:16' as const,
      label: 'Portrait',
      subtitle: '9:16',
      description: 'Vertical mobile-first format',
      platforms: 'TikTok, Instagram Reels, YouTube Shorts',
      icon: Smartphone,
      note: 'Optimized for mobile viewing'
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

      // Reset positioning
      options.style.top = '';
      options.style.bottom = '';
      options.style.marginTop = '';
      options.style.marginBottom = '';

      // If dropdown would overflow bottom, position it above
      if (rect.bottom > viewportHeight && rect.top > rect.height) {
        options.style.top = 'auto';
        options.style.bottom = '100%';
        options.style.marginTop = '0';
        options.style.marginBottom = '0.25rem';
      }
    }
  }, [isOpen]);

  const selectedOption = aspectRatioOptions.find(opt => opt.value === selectedAspectRatio);

  const handleOptionSelect = (value: '16:9' | '9:16') => {
    onAspectRatioChange(value);
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        {showIcon && selectedOption && <selectedOption.icon className="w-4 h-4" />}
        {label}
      </label>
      <div className="relative">
        {/* Custom Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-md transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            {selectedOption?.icon && (
              <selectedOption.icon className="w-4 h-4 text-gray-500" />
            )}
            <div>
              <span className="font-medium">{selectedOption?.label}</span>
              {selectedOption?.subtitle && (
                <span className="text-gray-500 ml-1">({selectedOption.subtitle})</span>
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
            {aspectRatioOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value)}
                className={cn(
                  "w-full px-3 py-3 text-left text-sm transition-colors duration-150 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0",
                  selectedAspectRatio === option.value
                    ? "bg-gray-50 text-gray-900"
                    : "text-gray-700"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <option.icon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {option.subtitle}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {option.description}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {option.platforms}
                      </div>
                      <div className="text-xs text-blue-600 mt-1 font-medium">
                        {option.note}
                      </div>
                    </div>
                  </div>
                  {selectedAspectRatio === option.value && (
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