'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import VideoDurationSelector from './VideoDurationSelector';
import VideoQualitySelector from './VideoQualitySelector';
import VideoModelSelector from './VideoModelSelector';
import LanguageSelector, { LanguageCode } from './LanguageSelector';
import FormatSelector, { type Format } from './FormatSelector';

// VideoModel type from constants (including 'auto')
type VideoModel = 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';

interface ConfigPopoverProps {
  // Duration props
  videoDuration: '8' | '10' | '15';
  onDurationChange: (duration: '8' | '10' | '15') => void;
  disabledDurations?: Array<'8' | '10' | '15'>;

  // Quality props
  videoQuality: 'standard' | 'high';
  onQualityChange: (quality: 'standard' | 'high') => void;
  disabledQualities?: Array<'standard' | 'high'>;

  // Model props
  selectedModel: VideoModel;
  onModelChange: (model: VideoModel) => void;
  userCredits: number;

  // Language props
  selectedLanguage: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;

  // Format props
  format: Format;
  onFormatChange: (format: Format) => void;

  disabled?: boolean;
  variant?: 'default' | 'minimal';
}

export default function ConfigPopover({
  videoDuration,
  onDurationChange,
  disabledDurations = [],
  videoQuality,
  onQualityChange,
  disabledQualities = [],
  selectedModel,
  onModelChange,
  userCredits,
  selectedLanguage,
  onLanguageChange,
  format,
  onFormatChange,
  disabled = false,
  variant = 'default',
}: ConfigPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const isMinimal = variant === 'minimal';

  // Track viewport to render a mobile-friendly drawer
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateMatch);
      return () => mediaQuery.removeEventListener('change', updateMatch);
    }

    // Safari fallback
    mediaQuery.addListener(updateMatch);
    return () => mediaQuery.removeListener(updateMatch);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Config Button */}
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          isMinimal
            ? 'w-11 h-11 rounded-full border border-gray-300 bg-white flex items-center justify-center shadow-sm hover:border-gray-400'
            : 'flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50',
          'transition-colors duration-200',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''
        )}
        aria-label="Open configuration"
        title="Advanced configuration"
      >
        <Settings className={`w-5 h-5 text-gray-600 ${isOpen ? 'rotate-90' : ''} transition-transform duration-300`} />
        {!isMinimal && (
          <span className="text-sm font-medium text-gray-700">Config</span>
        )}
      </button>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <>
            {isMobile && (
              <motion.button
                aria-label="Close configuration drawer"
                type="button"
                onClick={() => setIsOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 bg-black/20 z-[90]"
              />
            )}
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, y: isMobile ? 30 : 10, scale: isMobile ? 1 : 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isMobile ? 30 : 10, scale: isMobile ? 1 : 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={cn(
                'bg-white rounded-lg shadow-2xl border border-gray-200 z-[100] overflow-visible',
                isMobile
                  ? 'fixed inset-x-4 bottom-4 max-h-[80vh] overflow-y-auto origin-bottom'
                  : 'absolute right-0 bottom-full mb-2 w-96 origin-bottom-right'
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-700" />
                <h3 className="font-semibold text-gray-900">Video Configuration</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Format Selector (Simplified - only 9:16 and 16:9) */}
              <FormatSelector
                outputMode="video"
                selectedFormat={format}
                onFormatChange={onFormatChange}
                label="Aspect Ratio"
                className=""
              />

              {/* Duration Selector */}
              <VideoDurationSelector
                selectedDuration={videoDuration}
                onDurationChange={onDurationChange}
                disabledDurations={disabledDurations}
                label="Duration"
                showIcon
              />

              {/* Quality Selector */}
              <VideoQualitySelector
                selectedQuality={videoQuality}
                onQualityChange={onQualityChange}
                disabledQualities={disabledQualities}
                label="Quality"
                showIcon
              />

              {/* Model Selector */}
              <VideoModelSelector
                credits={userCredits}
                selectedModel={selectedModel}
                onModelChange={onModelChange}
                videoDuration={videoDuration}
                videoQuality={videoQuality}
                label="AI Model"
                showIcon
                hiddenModels={['auto']}
              />

              {/* Language Selector */}
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={onLanguageChange}
                label="Language"
                showIcon
              />
            </div>

            {/* Footer tip */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                These settings will be applied to your next generation
              </p>
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
