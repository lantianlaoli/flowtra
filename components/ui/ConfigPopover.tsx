'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import VideoDurationSelector, { type VideoDurationOption } from './VideoDurationSelector';
import VideoQualitySelector from './VideoQualitySelector';
import VideoModelSelector from './VideoModelSelector';
import LanguageSelector, { LanguageCode } from './LanguageSelector';
import FormatSelector, { type Format } from './FormatSelector';
import type { VideoDuration } from '@/lib/constants';

// VideoModel type from constants (including 'auto')
type VideoModel = 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'grok' | 'kling';

interface ConfigPopoverProps {
  // Duration props
  videoDuration: VideoDuration;
  onDurationChange: (duration: VideoDuration) => void;
  disabledDurations?: VideoDuration[];
  durationOptions?: VideoDurationOption[];
  recommendedDuration?: VideoDuration | null; // NEW: Recommended duration from competitor ad

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
  formatDisabled?: boolean;
  formatHelperText?: string;

  // Watermark props
  watermarkEnabled: boolean;
  onWatermarkEnabledChange: (enabled: boolean) => void;

  disabled?: boolean;
  variant?: 'default' | 'minimal';
  mode?: 'video' | 'photo';
  photoAspectRatio?: string;
  onPhotoAspectRatioChange?: (ratio: string) => void;
  photoAspectRatioOptions?: string[];
  photoResolution?: '1K' | '2K' | '4K';
  onPhotoResolutionChange?: (resolution: '1K' | '2K' | '4K') => void;
  photoResolutionOptions?: Array<'1K' | '2K' | '4K'>;
  photoOutputFormat?: 'png' | 'jpg';
  onPhotoOutputFormatChange?: (format: 'png' | 'jpg') => void;
  photoOutputFormatOptions?: Array<'png' | 'jpg'>;
}

export default function ConfigPopover({
  videoDuration,
  onDurationChange,
  disabledDurations = [],
  durationOptions,
  recommendedDuration, // NEW
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
  formatDisabled = false,
  formatHelperText,
  watermarkEnabled,
  onWatermarkEnabledChange,
  disabled = false,
  variant = 'default',
  mode = 'video',
  photoAspectRatio,
  onPhotoAspectRatioChange,
  photoAspectRatioOptions = [],
  photoResolution,
  onPhotoResolutionChange,
  photoResolutionOptions = ['1K', '2K', '4K'],
  photoOutputFormat,
  onPhotoOutputFormatChange,
  photoOutputFormatOptions = ['png', 'jpg'],
}: ConfigPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const isMinimal = variant === 'minimal';
  const isPhotoMode = mode === 'photo';

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

  // Update button position when opening popover
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  const headerTitle = 'Config';

  const renderPhotoOptions = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Aspect Ratio
        </label>
        <div className="flex flex-wrap gap-2">
          {photoAspectRatioOptions.map(option => {
            const isSelected = option === photoAspectRatio;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onPhotoAspectRatioChange?.(option)}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Resolution
        </label>
        <div className="flex flex-wrap gap-2">
          {photoResolutionOptions.map(option => {
            const isSelected = option === photoResolution;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onPhotoResolutionChange?.(option)}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Output Format
        </label>
        <div className="flex flex-wrap gap-2">
          {photoOutputFormatOptions.map(option => {
            const isSelected = option === photoOutputFormat;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onPhotoOutputFormatChange?.(option as 'png' | 'jpg')}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-sm font-medium transition-colors uppercase',
                  isSelected
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderVideoOptions = () => (
    <div className="space-y-4">
      <FormatSelector
        outputMode="video"
        selectedFormat={format}
        onFormatChange={onFormatChange}
        label="Aspect Ratio"
        disabled={formatDisabled}
      />
      {formatHelperText && (
        <p className="text-xs text-gray-500">{formatHelperText}</p>
      )}

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

      <VideoDurationSelector
        selectedDuration={videoDuration}
        onDurationChange={onDurationChange}
        disabledDurations={disabledDurations}
        recommendedDuration={recommendedDuration}
        label="Duration"
        showIcon
        disabled={disabled}
        options={durationOptions}
      />

      <VideoQualitySelector
        selectedQuality={videoQuality}
        onQualityChange={onQualityChange}
        disabledQualities={disabledQualities}
        label="Quality"
        showIcon
      />
    </div>
  );

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
      {isOpen && buttonRect && typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
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
              style={isMobile ? {} : {
                position: 'fixed',
                right: `${window.innerWidth - buttonRect.right}px`,
                bottom: `${window.innerHeight - buttonRect.top + 8}px`,
              }}
              className={cn(
                'bg-white rounded-lg shadow-2xl border border-gray-200 z-[110] overflow-visible',
                isMobile
                  ? 'fixed inset-x-4 bottom-4 max-h-[80vh] overflow-y-auto origin-bottom'
                  : 'w-96 origin-bottom-right'
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-700" />
                <h3 className="font-semibold text-gray-900">{headerTitle}</h3>
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
              {isPhotoMode ? renderPhotoOptions() : renderVideoOptions()}

              {/* Language Selector */}
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={onLanguageChange}
                label="Language"
                showIcon
              />

              {/* Watermark Toggle */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Brand Watermark
                </label>
                <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 font-medium">
                      Add brand watermark
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Display brand name on cover image
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={watermarkEnabled}
                    onClick={() => onWatermarkEnabledChange(!watermarkEnabled)}
                    className={cn(
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                      watermarkEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        watermarkEnabled ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Footer tip */}
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                These settings will be applied to your next generation
              </p>
            </div>
            </motion.div>
          </>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
