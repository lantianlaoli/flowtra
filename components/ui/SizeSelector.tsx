'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Crop, Square, Smartphone, Monitor, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getImageSizeOptions, getAutoImageSize } from '@/lib/constants';

interface SizeSelectorProps {
  selectedSize: string;
  onSizeChange: (size: string) => void;
  imageModel?: 'nano_banana' | 'seedream';
  videoAspectRatio?: '16:9' | '9:16';
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export default function SizeSelector({
  selectedSize,
  onSizeChange,
  imageModel = 'seedream',
  videoAspectRatio = '16:9',
  label = 'Image Format',
  className,
  showIcon = false
}: SizeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  // Get available size options based on image model
  const getAvailableSizes = () => {
    if (!imageModel) return ['auto'];
    return getImageSizeOptions(imageModel);
  };

  const availableSizes = getAvailableSizes();

  // Get auto size description based on current settings
  const getAutoDescription = () => {
    if (imageModel === 'nano_banana') {
      return 'Preserves original dimensions';
    }
    
    if (imageModel === 'seedream' && videoAspectRatio) {
      const autoSize = getAutoImageSize(videoAspectRatio, imageModel);
      if (autoSize === 'landscape_16_9') {
        return 'Matches video format (16:9)';
      } else if (autoSize === 'portrait_16_9') {
        return 'Matches video format (9:16)';
      }
    }
    
    return 'Smart size selection';
  };

  // All size options with user-facing scenario descriptions
  const allSizeOptions = [
    {
      value: 'auto',
      label: 'Auto',
      subtitle: 'Smart',
      description: getAutoDescription(),
      platforms: imageModel === 'nano_banana' ? 'Original dimensions' : 'Matches video format',
      icon: Square,
      ratio: null
    },
    {
      value: 'square',
      label: 'Square',
      subtitle: '1:1',
      description: 'Perfect square format',
      platforms: 'Instagram posts, Facebook ads',
      icon: Square,
      ratio: '1:1'
    },
    {
      value: 'square_hd',
      label: 'Square HD',
      subtitle: '1:1 HD',
      description: 'High quality square',
      platforms: 'Premium Instagram posts',
      icon: Square,
      ratio: '1:1'
    },
    {
      value: 'portrait_4_3',
      label: 'Portrait',
      subtitle: '3:4',
      description: 'Vertical content format',
      platforms: 'Instagram Feed, Facebook vertical',
      icon: Smartphone,
      ratio: '3:4'
    },
    {
      value: 'portrait_3_2',
      label: 'Portrait',
      subtitle: '2:3',
      description: 'Classic portrait format',
      platforms: 'Print media, professional photos',
      icon: Smartphone,
      ratio: '2:3'
    },
    {
      value: 'portrait_16_9',
      label: 'Vertical',
      subtitle: '9:16',
      description: 'Mobile-first vertical',
      platforms: 'TikTok, Instagram Reels, Stories',
      icon: Smartphone,
      ratio: '9:16'
    },
    {
      value: 'portrait_5_4',
      label: 'Portrait',
      subtitle: '4:5',
      description: 'Vertical with more headroom',
      platforms: 'Pinterest, flyers, posters',
      icon: Smartphone,
      ratio: '4:5'
    },
    {
      value: 'landscape_4_3',
      label: 'Standard',
      subtitle: '4:3',
      description: 'Traditional display format',
      platforms: 'Facebook ads, presentations',
      icon: Monitor,
      ratio: '4:3'
    },
    {
      value: 'landscape_3_2',
      label: 'Classic',
      subtitle: '3:2',
      description: 'Classic landscape format',
      platforms: 'Photography, print media',
      icon: Monitor,
      ratio: '3:2'
    },
    {
      value: 'landscape_5_4',
      label: 'Standard',
      subtitle: '5:4',
      description: 'Balanced landscape',
      platforms: 'Display ads, product shots',
      icon: Monitor,
      ratio: '5:4'
    },
    {
      value: 'landscape_16_9',
      label: 'Widescreen',
      subtitle: '16:9',
      description: 'Cinematic widescreen',
      platforms: 'YouTube covers, banner ads',
      icon: Video,
      ratio: '16:9'
    },
    {
      value: 'landscape_21_9',
      label: 'Ultra Wide',
      subtitle: '21:9',
      description: 'Ultra-wide cinematic',
      platforms: 'Banner ads, hero images',
      icon: Video,
      ratio: '21:9'
    }
  ];

  // Filter options based on available sizes for the selected model
  const sizeOptions = allSizeOptions.filter(option => 
    availableSizes.includes(option.value)
  );

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

  const selectedOption = sizeOptions.find(opt => opt.value === selectedSize);

  const handleOptionSelect = (value: string) => {
    onSizeChange(value);
    setIsOpen(false);
  };

  return (
    <div className={cn("space-y-3", className)} ref={dropdownRef}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        {showIcon && <Crop className="w-4 h-4" />}
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
            className="absolute left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md overflow-hidden z-50 shadow-lg max-h-60 overflow-y-auto"
            style={{ maxHeight: '200px' }}
          >
            {sizeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value)}
                className={cn(
                  "w-full px-3 py-3 text-left text-sm transition-colors duration-150 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0",
                  selectedSize === option.value
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
                        {option.ratio && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {option.ratio}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {option.description}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {option.platforms}
                      </div>
                    </div>
                  </div>
                  {selectedSize === option.value && (
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
