'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMAGE_CREDIT_COSTS, canAffordImageModel, getAutoImageModeSelection, getImageProcessingTime } from '@/lib/constants';

interface ImageModelSelectorProps {
  credits?: number;
  selectedModel: 'auto' | 'nano_banana' | 'seedream';
  onModelChange: (model: 'auto' | 'nano_banana' | 'seedream') => void;
  label?: string;
  className?: string;
  showIcon?: boolean;
  defaultModel?: 'auto' | 'nano_banana' | 'seedream';
  hiddenModels?: Array<'auto' | 'nano_banana' | 'seedream'>;
}

export default function ImageModelSelector({
  credits,
  selectedModel,
  onModelChange,
  label = 'Image Model',
  className,
  showIcon = false,
  hiddenModels
}: ImageModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Model options for dropdown with credit costs and processing times
  const modelOptions = useMemo(() => {
    const autoSelection = getAutoImageModeSelection();
    return [
      {
        value: 'auto',
        label: 'Auto',
        description: '',
        cost: IMAGE_CREDIT_COSTS[autoSelection],
        processingTime: getImageProcessingTime(autoSelection),
        affordable: canAffordImageModel(credits || 0, 'auto'),
        showCost: false, // Don't show cost for auto since it's free
        features: 'Smart selection'
      },
      {
        value: 'nano_banana',
        label: 'Nano Banana',
        description: 'Fast generation',
        cost: IMAGE_CREDIT_COSTS.nano_banana,
        processingTime: getImageProcessingTime('nano_banana'),
        affordable: canAffordImageModel(credits || 0, 'nano_banana'),
        showCost: false, // Free
        features: 'Fast generation'
      },
      {
        value: 'seedream',
        label: 'Seedream 4.0',
        description: 'High quality',
        cost: IMAGE_CREDIT_COSTS.seedream,
        processingTime: getImageProcessingTime('seedream'),
        affordable: canAffordImageModel(credits || 0, 'seedream'),
        showCost: false, // Free
        features: 'High quality'
      }
    ];
  }, [credits]);
  const visibleOptions = useMemo(
    () =>
      modelOptions.filter(
        (option) => !hiddenModels?.includes(option.value as 'auto' | 'nano_banana' | 'seedream')
      ),
    [modelOptions, hiddenModels]
  );

  useEffect(() => {
    if (hiddenModels?.includes(selectedModel)) {
      const fallback = visibleOptions[0];
      if (fallback && fallback.value !== selectedModel) {
        onModelChange(fallback.value as 'auto' | 'nano_banana' | 'seedream');
      }
    }
  }, [hiddenModels, selectedModel, visibleOptions, onModelChange]);

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

  const selectedOption = visibleOptions.find(opt => opt.value === selectedModel) || visibleOptions[0];

  const handleOptionSelect = (value: 'auto' | 'nano_banana' | 'seedream', affordable: boolean) => {
    if (!affordable) return; // Prevent selection of unaffordable options (though all are free)
    onModelChange(value);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('flowtra_image_model', value);
      }
    } catch {}
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        {showIcon && <ImageIcon className="w-4 h-4" />}
        {label}
      </label>
      <div className="relative">
        {/* Custom Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-md transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
        >
          <div className="min-w-0 flex flex-col">
            <span className="font-medium truncate">{selectedOption?.label}</span>
            {(selectedOption?.description || selectedOption?.features) && (
              <span className="text-xs text-gray-500 truncate">
                {selectedOption?.description || selectedOption?.features}
              </span>
            )}
          </div>
          <div className={`w-4 h-4 flex items-center justify-center transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-3 w-3 text-gray-600" />
          </div>
        </button>

        {/* Custom Dropdown Options */}
        <AnimatePresence>
        {isOpen && (
          <motion.div 
            ref={optionsRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-[9999] max-h-48 overflow-y-auto"
          >
            {visibleOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value as 'auto' | 'nano_banana' | 'seedream', option.affordable)}
                disabled={!option.affordable}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors duration-150 flex items-center justify-between",
                  !option.affordable
                    ? "cursor-not-allowed opacity-50 bg-gray-50"
                    : "hover:bg-gray-100 cursor-pointer",
                  selectedModel === option.value
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700"
                )}
              >
                <div className="flex flex-1 items-start justify-between">
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    {(option.description || option.features) && (
                      <span className="text-xs text-gray-500">{option.description || option.features}</span>
                    )}
                  </div>
                </div>
                {selectedModel === option.value && option.affordable && (
                  <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2">
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
