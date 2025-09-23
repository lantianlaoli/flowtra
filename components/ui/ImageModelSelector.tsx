'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMAGE_CREDIT_COSTS, canAffordImageModel, getAutoImageModeSelection, getImageProcessingTime } from '@/lib/constants';

interface ImageModelSelectorProps {
  credits?: number;
  selectedModel: 'auto' | 'nano_banana' | 'seedream';
  onModelChange: (model: 'auto' | 'nano_banana' | 'seedream') => void;
  label?: string;
  className?: string;
}

export default function ImageModelSelector({
  credits,
  selectedModel,
  onModelChange,
  label = 'Image Model',
  className
}: ImageModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Model options for dropdown with credit costs and processing times
  const getModelOptions = () => {
    const autoSelection = getAutoImageModeSelection();
    return [
      {
        value: 'auto',
        label: 'Auto',
        description: '',
        cost: IMAGE_CREDIT_COSTS[autoSelection],
        processingTime: getImageProcessingTime(autoSelection),
        affordable: canAffordImageModel(credits || 0, 'auto'),
        showCost: false // Don't show cost for auto since it's free
      },
      {
        value: 'nano_banana',
        label: 'Nano Banana',
        description: 'Fast generation',
        cost: IMAGE_CREDIT_COSTS.nano_banana,
        processingTime: getImageProcessingTime('nano_banana'),
        affordable: canAffordImageModel(credits || 0, 'nano_banana'),
        showCost: false // Free
      },
      {
        value: 'seedream',
        label: 'Seedream 4.0',
        description: 'High quality',
        cost: IMAGE_CREDIT_COSTS.seedream,
        processingTime: getImageProcessingTime('seedream'),
        affordable: canAffordImageModel(credits || 0, 'seedream'),
        showCost: false // Free
      }
    ];
  };

  const modelOptions = getModelOptions();

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

  const selectedOption = modelOptions.find(opt => opt.value === selectedModel);

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
      <label className="block text-sm font-medium text-gray-900">
        {label}
      </label>
      <div className="relative">
        {/* Custom Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm bg-white border border-gray-300 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 rounded-md transition-colors duration-150 text-gray-900 cursor-pointer text-left flex items-center justify-between"
        >
          <span className="font-medium">{selectedOption?.label}</span>
          <div className={`w-4 h-4 flex items-center justify-center transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>
            <ChevronDown className="h-3 w-3 text-gray-600" />
          </div>
        </button>

        {/* Custom Dropdown Options */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md overflow-hidden z-50">
            {modelOptions.map((option) => (
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
                <div className="flex items-center justify-between flex-1">
                  <div className="flex items-center gap-2">
                    <div>
                      <span className="font-medium">{option.label}</span>
                      {option.description && (
                        <div className="text-xs text-gray-500">{option.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-medium text-green-600">
                      Free
                    </div>
                    <div className="text-xs text-gray-500">
                      {option.processingTime}
                    </div>
                  </div>
                </div>
                {selectedModel === option.value && option.affordable && (
                  <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center ml-2">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}