'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/providers/I18nProvider';
import VideoDurationSelector, { type VideoDurationOption } from './VideoDurationSelector';
import VideoModelSelector from './VideoModelSelector';
import VideoQualitySelector from './VideoQualitySelector';
import LanguageSelector, { LanguageCode } from './LanguageSelector';
import FormatSelector, { type Format } from './FormatSelector';
import type { CloneVideoQuality, VideoDuration, VideoModel } from '@/lib/constants';

type QualityOptionOverride = {
  value: CloneVideoQuality;
  label: string;
  creditsPerSecondLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
};

interface ConfigPopoverProps {
  // Duration props
  videoDuration?: VideoDuration;
  onDurationChange?: (duration: VideoDuration) => void;
  disabledDurations?: VideoDuration[];
  durationOptions?: VideoDurationOption[];
  recommendedDuration?: VideoDuration | null;
  hideDurationSelector?: boolean;

  // Model props
  selectedModel?: VideoModel;
  onModelChange?: (model: VideoModel) => void;
  userCredits?: number;
  disabledModels?: VideoModel[];
  disabledModelReasons?: Partial<Record<VideoModel, string>>;
  hiddenModels?: VideoModel[];
  hideModelSelector?: boolean;

  // Quality props
  selectedVideoQuality?: CloneVideoQuality;
  onVideoQualityChange?: (quality: CloneVideoQuality) => void;
  hideVideoQualitySelector?: boolean;
  videoQualityOptions?: QualityOptionOverride[];

  // Language props
  selectedLanguage?: LanguageCode;
  onLanguageChange?: (language: LanguageCode) => void;
  recommendedLanguage?: LanguageCode | null;
  hideLanguageSelector?: boolean;

  // Format props
  format?: Format;
  onFormatChange?: (format: Format) => void;
  formatDisabled?: boolean;
  formatHelperText?: string;
  hideFormatSelector?: boolean;

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
  recommendedDuration,
  hideDurationSelector = false,
  selectedModel,
  onModelChange,
  userCredits = 0,
  disabledModels = [],
  disabledModelReasons = {},
  hiddenModels,
  hideModelSelector = false,
  selectedVideoQuality,
  onVideoQualityChange,
  hideVideoQualitySelector = false,
  videoQualityOptions,
  selectedLanguage,
  onLanguageChange,
  recommendedLanguage,
  hideLanguageSelector = false,
  format,
  onFormatChange,
  formatDisabled = false,
  formatHelperText,
  hideFormatSelector = false,
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
  const { locale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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

  // Set mounted state to prevent hydration issues with portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target.closest('.config-select-panel')) {
        return;
      }
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

  const copy = locale === 'zh'
    ? {
        headerTitle: '配置',
        aspectRatio: '画幅比例',
        resolution: '分辨率',
        outputFormat: '输出格式',
        videoModel: '视频模型',
        quality: '画质',
        duration: '时长',
        language: '语言',
        openConfiguration: '打开配置',
        advancedConfiguration: '高级配置',
        closeConfigurationDrawer: '关闭配置抽屉',
        close: '关闭',
      }
    : {
        headerTitle: 'Config',
        aspectRatio: 'Aspect Ratio',
        resolution: 'Resolution',
        outputFormat: 'Output Format',
        videoModel: 'Video Model',
        quality: 'Quality',
        duration: 'Duration',
        language: 'Language',
        openConfiguration: 'Open configuration',
        advancedConfiguration: 'Advanced configuration',
        closeConfigurationDrawer: 'Close configuration drawer',
        close: 'Close',
      };

  const renderPhotoOptions = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {copy.aspectRatio}
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
                  'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
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
          {copy.resolution}
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
                  'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
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
          {copy.outputFormat}
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
                  'px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors uppercase',
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

  const renderVideoOptions = () => {
    const hasFormat = !hideFormatSelector && format && onFormatChange;
    const hasModel = !hideModelSelector && selectedModel && onModelChange && videoDuration;
    const hasQuality = !hideVideoQualitySelector && selectedModel && selectedVideoQuality && onVideoQualityChange && videoDuration;
    const hasDuration = !hideDurationSelector && videoDuration && onDurationChange;
    if (!hasFormat && !hasModel && !hasQuality && !hasDuration) return null;

    return (
      <div className="space-y-4">
        {hasFormat && (
          <>
            <FormatSelector
              outputMode="video"
              selectedFormat={format}
              onFormatChange={onFormatChange}
              label={copy.aspectRatio}
              disabled={formatDisabled}
            />
            {formatHelperText && (
              <p className="text-xs text-gray-500">{formatHelperText}</p>
            )}
          </>
        )}

        {hasModel && (
          <VideoModelSelector
            credits={userCredits}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            videoDuration={videoDuration}
            videoQuality={selectedVideoQuality}
            disabledModels={disabledModels}
            disabledModelReasons={disabledModelReasons}
            hiddenModels={hiddenModels}
            label={copy.videoModel}
            showIcon
          />
        )}

        {hasQuality && (
          <VideoQualitySelector
            selectedModel={selectedModel}
            selectedQuality={selectedVideoQuality}
            onQualityChange={onVideoQualityChange}
            disabled={disabled}
            qualityOptionsOverride={videoQualityOptions}
            label={copy.quality}
          />
        )}

        {hasDuration && (
          <VideoDurationSelector
            selectedDuration={videoDuration}
            onDurationChange={onDurationChange}
            disabledDurations={disabledDurations}
            recommendedDuration={recommendedDuration}
            label={copy.duration}
            showIcon
            disabled={disabled}
            options={durationOptions}
          />
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Config Button */}
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'config-popover-button my-ads-button my-ads-button--secondary h-11 rounded-[14px] border border-[#dfdfd9] bg-white px-3 flex items-center gap-1.5 transition-all duration-200 outline-none',
          disabled
            ? 'bg-[#F7F7F7] border-[#E5E5E5] text-[#999999] cursor-not-allowed'
            : 'text-black',
          isOpen ? 'border-black ring-1 ring-black/10' : ''
        )}
        aria-label={copy.openConfiguration}
        title={copy.advancedConfiguration}
      >
        <Settings className={`w-4 h-4 ${isOpen ? 'rotate-90' : ''} transition-transform duration-300`} />
        <span className="text-sm font-medium">{copy.headerTitle}</span>
      </button>

      {/* Popover */}
      {mounted && isOpen && buttonRect && typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          <>
            {isMobile && (
              <motion.button
                aria-label={copy.closeConfigurationDrawer}
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
                'config-popover-panel bg-white rounded-[18px] shadow-2xl border border-gray-200 z-[110] overflow-visible',
                isMobile
                  ? 'fixed inset-x-4 bottom-4 max-h-[80vh] overflow-y-auto origin-bottom'
                  : 'w-[22rem] origin-bottom-right'
              )}
            >
              {/* Header */}
              <div className="config-popover-header flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-700" />
                <h3 className="font-semibold text-gray-900">{copy.headerTitle}</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="config-popover-close p-1 hover:bg-gray-200 rounded-md transition-colors"
                aria-label={copy.close}
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div
              className={cn(
                'config-popover-content p-4 space-y-4',
                isMobile ? 'max-h-[70vh] overflow-y-auto' : 'overflow-visible'
              )}
            >
              {isPhotoMode ? renderPhotoOptions() : renderVideoOptions()}

              {!hideLanguageSelector && selectedLanguage && onLanguageChange && (
                <LanguageSelector
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={onLanguageChange}
                  label={copy.language}
                  showIcon
                  recommendedLanguage={recommendedLanguage}
                />
              )}

            </div>

            </motion.div>
          </>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
