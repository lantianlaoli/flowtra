'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Target, Loader2, Info, ChevronRight, AlertTriangle, Play, Video } from 'lucide-react';
import { CompetitorAd } from '@/lib/supabase';
import CompetitorAdCard from '../CompetitorAdCard';
import { cn } from '@/lib/utils';
import { useI18n } from '@/providers/I18nProvider';

interface CompetitorAdSelectorProps {
  selectedCompetitorAd: CompetitorAd | null;
  onSelect: (competitorAd: CompetitorAd | null) => void;
  variant?: 'default' | 'compact';
  className?: string;
}

export default function CompetitorAdSelector({
  selectedCompetitorAd,
  onSelect,
  variant = 'default',
  className
}: CompetitorAdSelectorProps) {
  const { locale } = useI18n();
  const [competitorAds, setCompetitorAds] = useState<CompetitorAd[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);
  const copy = locale === 'zh'
    ? {
        noViralVideosYet: '还没有爆款视频',
        addViralVideosFirst: '请先在 Assets 页面添加爆款视频，用它们作为生成视频的参考。',
        loading: '加载中...',
        noVideos: '暂无视频',
        selectVideo: '选择视频',
        referenceViralVideo: '参考爆款视频',
        loadingViralVideos: '正在加载爆款视频...',
        selected: '已选择',
        viralVideoAvailable: '个爆款视频可选',
      }
    : {
        noViralVideosYet: 'No viral videos yet',
        addViralVideosFirst: 'Add viral videos in the Assets page to use them as reference for your video generation.',
        loading: 'Loading...',
        noVideos: 'No videos',
        selectVideo: 'Select video',
        referenceViralVideo: 'Reference Viral Video',
        loadingViralVideos: 'Loading viral videos...',
        selected: 'Selected',
        viralVideoAvailable: 'viral videos available',
      };

  // Set mounted state to prevent hydration issues with portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadCompetitorAds();
   
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isExpanded]);

  // Update button position when opening
  useEffect(() => {
    if (isExpanded && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
  }, [isExpanded]);

  const loadCompetitorAds = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/competitor-ads');
      if (response.ok) {
        const data = await response.json();
        setCompetitorAds(data.competitorAds || []);
      }
    } catch (error) {
      console.error('Error loading competitor ads:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (ad: CompetitorAd) => {
    if (selectedCompetitorAd?.id === ad.id) {
      // Deselect if clicking the same ad
      onSelect(null);
      setExpandedAdId(null);
    } else {
      onSelect(ad);
      // On mobile, collapse the expanded preview after selection
      if (isMobile) {
        setExpandedAdId(null);
      }
    }
  };

  const toggleAdExpansion = (adId: string) => {
    setExpandedAdId(expandedAdId === adId ? null : adId);
  };

  const compact = variant === 'compact';

  if (competitorAds.length === 0 && !compact) {
    return (
      <div className={cn('bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-6', className)}>
        <div className="flex items-start gap-4">
          <Info className="w-5 h-5 text-black flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-black font-semibold">{copy.noViralVideosYet}</p>
            <p className="text-sm text-[#666666] mt-2 leading-relaxed">
              {copy.addViralVideosFirst}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl overflow-hidden relative',
        compact ? 'rounded-lg bg-white border-none' : '',
        className
      )}
    >
      {/* Header - Always visible */}
      <button
        ref={buttonRef}
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'transition-all duration-200 outline-none',
          compact 
            ? 'inline-flex items-center justify-between gap-3 px-4 h-12 border border-[#E5E5E5] rounded-lg bg-white hover:border-[#CCCCCC] shadow-sm min-w-[180px]' 
            : 'w-full flex items-center gap-3 px-6 py-4 hover:bg-white'
        )}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <div
            className={cn(
              'flex items-center justify-center flex-shrink-0 bg-gray-100 rounded-full border border-gray-200',
              compact ? 'w-6 h-6' : 'w-10 h-10'
            )}
          >
            {isLoading ? (
              <Loader2 className={cn('text-gray-500 animate-spin', compact ? 'w-3.5 h-3.5' : 'w-5 h-5')} />
            ) : (
              <Video className={cn('text-gray-500', compact ? 'w-3.5 h-3.5' : 'w-5 h-5')} />
            )}
          </div>
          
          <div className="text-left min-w-0 flex-1">
            <h3 className={cn('font-semibold text-black truncate', compact ? 'text-sm' : 'text-sm')}>
              {compact ? (
                isLoading 
                  ? copy.loading
                  : selectedCompetitorAd 
                    ? selectedCompetitorAd.competitor_name
                    : competitorAds.length === 0 
                      ? copy.noVideos 
                      : copy.selectVideo
              ) : copy.referenceViralVideo}
            </h3>
            {!compact && (
              <p className="text-sm text-[#666666] mt-0.5 truncate">
                {isLoading
                  ? copy.loadingViralVideos
                  : selectedCompetitorAd
                    ? `${copy.selected}: ${selectedCompetitorAd.competitor_name}`
                    : locale === 'zh'
                      ? `${competitorAds.length}${copy.viralVideoAvailable}`
                      : `${competitorAds.length} ${competitorAds.length === 1 ? 'viral video available' : copy.viralVideoAvailable}`
                }
              </p>
            )}
          </div>
        </div>

        <svg
          className={cn('text-gray-400 transition-transform flex-shrink-0', compact ? 'w-4 h-4' : 'w-5 h-5', isExpanded ? 'rotate-180' : '')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Content - Render via Portal */}
      {mounted && isExpanded && buttonRect && typeof window !== 'undefined' && createPortal(
        <div
          ref={contentRef}
          style={{
            position: 'fixed',
            left: isMobile ? '16px' : `${buttonRect.left}px`,
            bottom: `${window.innerHeight - buttonRect.top + 8}px`,
            maxHeight: '50vh',
            width: isMobile ? 'calc(100vw - 32px)' : '400px',
            zIndex: 110,
          }}
          className="bg-white border border-[#E5E5E5] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.12)] overflow-hidden"
        >
          <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
            {competitorAds.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Info className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-900">{copy.noViralVideosYet}</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                    {locale === 'zh' ? '请先在 Assets 页面添加爆款视频。' : 'Add viral videos in the Assets page first.'}
                  </p>
               </div>
            ) : (
              /* List View (Desktop & Mobile unified for clarity) */
              <div className="flex flex-col gap-2">
                {competitorAds.map((ad) => (
                  <CompetitorAdCard
                    key={ad.id}
                    competitorAd={ad}
                    onEdit={() => {}} // No edit in selector mode
                    onDelete={() => {}} // No delete in selector mode
                    onSelect={handleSelect}
                    isSelected={selectedCompetitorAd?.id === ad.id}
                    mode="select"
                  />
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
