'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Clock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoDuration } from '@/lib/constants';

export interface VideoDurationOption {
  value: VideoDuration;
  label: string;
  description: string;
  features: string;
}

interface VideoDurationSelectorProps {
  selectedDuration: VideoDuration;
  onDurationChange: (duration: VideoDuration) => void;
  label?: string;
  className?: string;
  showIcon?: boolean;
  disabled?: boolean;
  disabledDurations?: VideoDuration[];
  options?: VideoDurationOption[];
  recommendedDuration?: VideoDuration | null; // NEW: Recommended duration from competitor ad
}

export default function VideoDurationSelector({
  selectedDuration,
  onDurationChange,
  label = 'Video Duration',
  className,
  showIcon = false,
  disabled = false,
  disabledDurations = [],
  options,
  recommendedDuration // NEW
}: VideoDurationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const handlePortalWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!portalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = portalRef.current;
    const isAtTop = scrollTop <= 0;
    const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;

    if ((event.deltaY < 0 && isAtTop) || (event.deltaY > 0 && isAtBottom)) {
      event.preventDefault();
    }
    event.stopPropagation();
  }, []);

  const durationOptions: VideoDurationOption[] = options ?? [
    {
      value: '8',
      label: '8 seconds',
      description: 'Standard short-form video',
      features: 'Perfect for quick product showcase'
    },
    {
      value: '10',
      label: '10 seconds',
      description: 'Extended presentation time',
      features: 'Ideal for detailed feature highlights'
    },
    {
      value: '15',
      label: '15 seconds',
      description: 'Full storytelling format',
      features: 'Comprehensive product narrative'
    }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inDropdown = dropdownRef.current?.contains(target);
      const inPortal = portalRef.current?.contains(target);
      if (!inDropdown && !inPortal) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Track button position for portal dropdown
  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const preferredHeight = 320;
      const openUpwards = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        180,
        Math.min(preferredHeight, openUpwards ? spaceAbove : spaceBelow)
      );
      const top = openUpwards
        ? rect.top - maxHeight - gap
        : rect.bottom + gap;

      setDropdownPosition({
        top: Math.max(8, top),
        left: rect.left,
        width: rect.width,
        maxHeight
      });
    };

    updatePosition();

    // Close dropdown on external scroll (but not when scrolling inside the dropdown itself)
    const handleScroll = (event: Event) => {
      // Don't close if scrolling inside the dropdown portal
      if (portalRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const selectedOption = durationOptions.find(opt => opt.value === selectedDuration);

  const handleOptionSelect = (value: VideoDuration) => {
    if (disabledDurations.includes(value)) return;
    onDurationChange(value);
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        {showIcon && <Clock className="w-4 h-4" />}
        {label}
      </label>
      <div className="relative">
        {/* Dropdown Button */}
        <button
          ref={buttonRef}
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
            <span className="font-medium truncate">
              {selectedOption?.label}
            </span>
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
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {isOpen && dropdownPosition && (
              <motion.div
                ref={portalRef}
                onWheelCapture={handlePortalWheel}
                onWheel={handlePortalWheel}
                onMouseDown={(event) => event.stopPropagation()}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                className="fixed bg-white border border-gray-300 rounded-md shadow-2xl z-[9999] overflow-hidden"
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                  maxHeight: dropdownPosition.maxHeight,
                  overflowY: 'auto'
                }}
              >
                {durationOptions.map((option) => {
                  const isDisabled = disabledDurations.includes(option.value);
                  const isRecommended = recommendedDuration === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleOptionSelect(option.value)}
                      onMouseDown={(event) => event.stopPropagation()}
                      disabled={isDisabled}
                      className={cn(
                        "w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 flex items-center justify-between border-b border-gray-100 last:border-b-0",
                        isDisabled
                          ? "cursor-not-allowed opacity-50 bg-gray-50"
                          : "hover:bg-gray-100 cursor-pointer",
                        selectedDuration === option.value
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-700"
                      )}
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Clock className={cn(
                            "w-4 h-4",
                            isDisabled ? "text-gray-400" : "text-gray-500"
                          )} />
                          <span className="font-medium">{option.label}</span>
                          {isRecommended && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                              <Sparkles className="w-3 h-3" />
                              Recommended
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {option.description}
                        </span>
                        <span className="text-xs text-gray-600">
                          {option.features}
                        </span>
                      </div>
                      {selectedDuration === option.value && !isDisabled && (
                        <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
    </div>
  );
}
