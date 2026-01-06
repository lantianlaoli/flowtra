'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Target, Loader2, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import { CompetitorAd } from '@/lib/supabase';
import CompetitorAdCard from '../CompetitorAdCard';
import { cn } from '@/lib/utils';

interface CompetitorAdSelectorProps {
  brandId: string | null;
  brandName?: string;
  selectedCompetitorAd: CompetitorAd | null;
  onSelect: (competitorAd: CompetitorAd | null) => void;
  variant?: 'default' | 'compact';
  className?: string;
}

export default function CompetitorAdSelector({
  brandId,
  selectedCompetitorAd,
  onSelect,
  variant = 'default',
  className
}: CompetitorAdSelectorProps) {
  const [competitorAds, setCompetitorAds] = useState<CompetitorAd[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

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
    if (brandId) {
      loadCompetitorAds();
    } else {
      setCompetitorAds([]);
      onSelect(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

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
    if (!brandId) return;

    try {
      setIsLoading(true);
      const response = await fetch(`/api/competitor-ads?brandId=${brandId}`);
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

  if (competitorAds.length === 0 && !compact && brandId) {
    return (
      <div className={cn('bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-6', className)}>
        <div className="flex items-start gap-4">
          <Info className="w-5 h-5 text-black flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-black font-semibold">No viral videos yet</p>
            <p className="text-sm text-[#666666] mt-2 leading-relaxed">
              Add viral videos in the Assets page to use them as reference for your video generation.
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
        compact ? 'h-12 rounded-lg bg-white' : '',
        className
      )}
    >
      {/* Header - Always visible */}
      <button
        ref={buttonRef}
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between transition-colors',
          compact ? 'h-12 px-4 hover:bg-[#F7F7F7]' : 'px-6 py-4 hover:bg-white'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'bg-black rounded-lg flex items-center justify-center flex-shrink-0',
              compact ? 'w-8 h-8' : 'w-10 h-10'
            )}
          >
            {isLoading ? (
              <Loader2 className={cn('text-white animate-spin', compact ? 'w-4 h-4' : 'w-5 h-5')} />
            ) : (
              <Target className={cn('text-white', compact ? 'w-4 h-4' : 'w-5 h-5')} />
            )}
          </div>
          <div className="text-left">
            <h3 className={cn('font-semibold text-black', compact ? 'text-sm' : 'text-sm')}>
              {compact ? (
                isLoading 
                  ? 'Loading...'
                  : selectedCompetitorAd 
                    ? 'Selected video' 
                    : !brandId 
                      ? 'Select Brand' 
                      : competitorAds.length === 0 
                        ? 'No videos found' 
                        : 'Select video'
              ) : 'Reference Viral Video'}
            </h3>
            {!compact && (
              <p className="text-sm text-[#666666] mt-0.5">
                {isLoading
                  ? 'Loading viral videos...'
                  : !brandId 
                    ? 'Select a brand to view videos' 
                    : selectedCompetitorAd
                      ? `Selected: ${selectedCompetitorAd.competitor_name}`
                      : `${competitorAds.length} viral ${competitorAds.length === 1 ? 'video' : 'videos'} available`
                }
              </p>
            )}
            {compact && (
              isLoading ? (
                <p className="text-xs text-[#666666] mt-0.5 truncate max-w-[160px]">
                  Please wait
                </p>
              ) : selectedCompetitorAd ? (
                <p className="text-xs text-[#666666] mt-0.5 truncate max-w-[160px]">
                  {selectedCompetitorAd.competitor_name}
                </p>
              ) : !brandId ? (
                <p className="text-xs text-[#666666] mt-0.5 truncate max-w-[160px]">
                  Required
                </p>
              ) : competitorAds.length === 0 && (
                 <p className="text-xs text-[#666666] mt-0.5 truncate max-w-[160px]">
                  Add in Assets
                </p>
              )
            )}
          </div>
        </div>
        <svg
          className={cn('text-black transition-transform', compact ? 'w-4 h-4' : 'w-5 h-5', isExpanded ? 'rotate-180' : '')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Content - Render via Portal */}
      {isExpanded && buttonRect && typeof window !== 'undefined' && createPortal(
        <div
          ref={contentRef}
          style={{
            position: 'fixed',
            left: `${buttonRect.left}px`,
            // Remove 'right' to allow width to grow based on content or max-width
            // right: `${window.innerWidth - buttonRect.right}px`, 
            bottom: `${window.innerHeight - buttonRect.top + 8}px`,
            maxHeight: '50vh',
            minWidth: '320px', // Ensure it's not too narrow
            maxWidth: '90vw',  // Prevent it from going off screen
            width: 'max-content', // Allow it to fit the grid
            zIndex: 110,
          }}
          className="bg-white border border-[#E5E5E5] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] overflow-hidden"
        >
          <div className="p-6 pb-16 space-y-4 max-h-[50vh] overflow-y-auto">
            {!brandId ? (
               <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Info className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-900">No Brand Selected</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                    Please select a brand first to see available viral videos.
                  </p>
               </div>
            ) : competitorAds.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-4 text-center">
                  <Info className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-900">No viral videos yet</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-[200px]">
                    Add viral videos in the Assets page first.
                  </p>
               </div>
            ) : (
              /* Desktop: Grid View */
              !isMobile ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
              ) : (
                /* Mobile: Compact List with Click-to-Expand */
                <div className="space-y-3">
                  {competitorAds.map((ad) => (
                    <div key={ad.id} className="border border-[#E5E5E5] rounded-xl overflow-hidden bg-white">
                      {/* Compact Header - Always Visible */}
                      <button
                        onClick={() => toggleAdExpansion(ad.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#F7F7F7] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Analysis Status Icon */}
                          <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center">
                            {ad.analysis_status === 'completed' ? (
                              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : ad.analysis_status === 'analyzing' ? (
                              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                            ) : ad.analysis_status === 'failed' ? (
                              <AlertTriangle className="w-6 h-6 text-red-600" />
                            ) : (
                              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>

                          {/* Ad Info */}
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-sm font-semibold text-black truncate">
                              {ad.competitor_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-0.5 rounded-lg font-medium bg-black text-white">
                                Video Analysis
                              </span>
                              {ad.video_duration_seconds && (
                                <span className="text-xs text-[#666666]">
                                  {ad.video_duration_seconds}s
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Selected Indicator */}
                          {selectedCompetitorAd?.id === ad.id && (
                            <div className="flex-shrink-0 bg-black text-white rounded-lg p-1.5">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Expand/Collapse Icon */}
                        <ChevronRight
                          className={`w-5 h-5 text-[#666666] flex-shrink-0 ml-2 transition-transform ${
                            expandedAdId === ad.id ? 'rotate-90' : ''
                          }`}
                        />
                      </button>

                      {/* Expanded Preview - Only show when expanded */}
                      {expandedAdId === ad.id && (
                        <div className="border-t border-[#E5E5E5] bg-[#F7F7F7] p-4">
                          <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 mb-4">
                            <div className="text-center">
                              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-black/5 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <p className="text-sm text-gray-600 font-medium">Analysis Data</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {ad.analysis_status === 'completed' ? 'Ready' : ad.analysis_status || 'Pending'}
                              </p>
                              {ad.video_duration_seconds && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Duration: {ad.video_duration_seconds}s
                                </p>
                              )}
                              {ad.language && (
                                <p className="text-xs text-gray-500">
                                  Language: {ad.language.toUpperCase()}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleSelect(ad)}
                            className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all ${
                              selectedCompetitorAd?.id === ad.id
                                ? 'bg-black text-white shadow-[0_20px_40px_rgba(0,0,0,0.1)]'
                                : 'bg-white text-black border border-[#E5E5E5] hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)]'
                            }`}
                          >
                            {selectedCompetitorAd?.id === ad.id ? 'Selected' : 'Select This Ad'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
