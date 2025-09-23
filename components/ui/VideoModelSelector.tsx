'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Lock, Coins, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CREDIT_COSTS, canAffordModel, getAutoModeSelection, getProcessingTime } from '@/lib/constants';

interface VideoModelSelectorProps {
  credits: number;
  selectedModel: 'auto' | 'veo3' | 'veo3_fast';
  onModelChange: (model: 'auto' | 'veo3' | 'veo3_fast') => void;
  label?: string;
  className?: string;
  showIcon?: boolean;
  hideCredits?: boolean;
}

export default function VideoModelSelector({
  credits,
  selectedModel,
  onModelChange,
  label = 'Video Model',
  className,
  showIcon = false,
  hideCredits = false
}: VideoModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Model options for dropdown with credit costs and processing times
  const getModelOptions = () => {
    const autoSelection = getAutoModeSelection(credits);
    return [
      {
        value: 'auto',
        label: 'Auto',
        description: '',
        cost: autoSelection ? CREDIT_COSTS[autoSelection] : CREDIT_COSTS.veo3_fast,
        processingTime: autoSelection ? getProcessingTime(autoSelection) : '2-3 min',
        affordable: canAffordModel(credits, 'auto'),
        showCost: !!autoSelection && !hideCredits,
        features: 'Smart selection'
      },
      {
        value: 'veo3',
        label: 'VEO3 High',
        description: '',
        cost: CREDIT_COSTS.veo3,
        processingTime: getProcessingTime('veo3'),
        affordable: canAffordModel(credits, 'veo3'),
        showCost: !hideCredits,
        features: 'Premium quality'
      },
      {
        value: 'veo3_fast',
        label: 'VEO3 Fast',
        description: '',
        cost: CREDIT_COSTS.veo3_fast,
        processingTime: getProcessingTime('veo3_fast'),
        affordable: canAffordModel(credits, 'veo3_fast'),
        showCost: !hideCredits,
        features: 'Fast processing'
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

  const selectedOption = modelOptions.find(opt => opt.value === selectedModel);

  const handleOptionSelect = (value: 'auto' | 'veo3' | 'veo3_fast', affordable: boolean) => {
    if (!affordable) return; // Prevent selection of unaffordable options
    onModelChange(value);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('flowtra_video_model', value);
      }
    } catch {}
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        {showIcon && <Video className="w-4 h-4" />}
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
          <div 
            ref={optionsRef}
            className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
          >
            {modelOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value as 'auto' | 'veo3' | 'veo3_fast', option.affordable)}
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
                      {option.features && !hideCredits && (
                        <div className="text-xs text-gray-500">{option.features}</div>
                      )}
                      {hideCredits && option.features && (
                        <div className="text-xs text-gray-500">{option.features}</div>
                      )}
                    </div>
                    {!option.affordable && (
                      <Lock className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                  {option.showCost && (
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-medium",
                      option.affordable ? "text-gray-600" : "text-red-500"
                    )}>
                      <Coins className="w-3 h-3" />
                      <span>{option.cost}</span>
                    </div>
                  )}
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