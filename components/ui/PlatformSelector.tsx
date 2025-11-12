'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Platform = 'tiktok' | 'facebook' | 'instagram' | 'youtube';

interface PlatformOption {
  id: Platform;
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

interface PlatformSelectorProps {
  selectedPlatform: Platform;
  onPlatformChange: (platform: Platform) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
  variant?: 'default' | 'compact';
}

const PLATFORMS: PlatformOption[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
    color: '#000000',
    description: 'Vertical short videos (9:16, 8s)',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    color: '#1877F2',
    description: 'Landscape videos (16:9, 10s)',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
    color: '#E4405F',
    description: 'Reels & Stories (9:16, 10s)',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    color: '#FF0000',
    description: 'YouTube Shorts (16:9, 15s)',
  },
];

export default function PlatformSelector({
  selectedPlatform,
  onPlatformChange,
  disabled = false,
  label = 'Platform',
  className,
  variant = 'default',
}: PlatformSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const isCompact = variant === 'compact';

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

  const selectedOption = PLATFORMS.find(p => p.id === selectedPlatform);

  const handleOptionSelect = (platform: Platform) => {
    if (!disabled) {
      onPlatformChange(platform);
      setIsOpen(false);
    }
  };

  return (
    <div
      className={cn(isCompact ? 'relative' : 'space-y-2', className)}
      ref={dropdownRef}
    >
      {!isCompact && label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Dropdown Button */}
        <button
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            isCompact
              ? "w-11 h-11 rounded-full border border-gray-200 bg-white flex items-center justify-center transition-colors shadow-sm"
              : "w-full px-3 py-2 text-sm bg-white border rounded-md transition-colors duration-150 text-left flex items-center justify-between",
            disabled
              ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
              : "hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 cursor-pointer",
            isCompact ? "text-gray-900" : "text-gray-900"
          )}
          title={selectedOption?.name ?? 'Select platform'}
          aria-label="Select platform"
        >
          <div
            className={cn(
              "flex items-center min-w-0",
              isCompact ? "justify-center" : "gap-2"
            )}
          >
            {selectedOption && (
              <>
                <span
                  style={{ color: selectedOption.color }}
                  className={cn(isCompact ? 'text-lg' : '')}
                >
                  {selectedOption.icon}
                </span>
                {!isCompact && (
                  <span className="font-medium truncate">
                    {selectedOption.name}
                  </span>
                )}
              </>
            )}
          </div>
          {!isCompact && (
            <div
              className={`w-4 h-4 flex items-center justify-center transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            >
              <ChevronDown className="h-3 w-3 text-gray-600" />
            </div>
          )}
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
              className={cn(
                "absolute z-[9999]",
                isCompact
                  ? "bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col gap-2 bg-white border border-gray-200 rounded-2xl px-3 py-3 shadow-2xl"
                  : "left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden"
              )}
            >
              {PLATFORMS.map((option) => {
                const isActive = selectedPlatform === option.id;
                if (isCompact) {
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleOptionSelect(option.id)}
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-all border text-lg",
                        isActive
                          ? "bg-gray-900 text-white border-gray-900 shadow-lg"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                      )}
                      title={option.name}
                      aria-label={option.name}
                    >
                      <span style={{ color: isActive ? 'inherit' : option.color }}>
                        {option.icon}
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionSelect(option.id)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between border-b border-gray-100 last:border-b-0",
                      "hover:bg-gray-100 cursor-pointer",
                      isActive ? "bg-gray-50 text-gray-900" : "text-gray-700"
                    )}
                  >
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span style={{ color: option.color }}>
                          {option.icon}
                        </span>
                        <span className="font-medium">{option.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {option.description}
                      </span>
                    </div>
                    {isActive && (
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
