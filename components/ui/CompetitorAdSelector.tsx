'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Target, Loader2, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { CompetitorAd } from '@/lib/supabase';
import CompetitorAdCard from '../CompetitorAdCard';

interface CompetitorAdSelectorProps {
  brandId: string | null;
  brandName?: string;
  selectedCompetitorAd: CompetitorAd | null;
  onSelect: (competitorAd: CompetitorAd | null) => void;
  className?: string;
}

export default function CompetitorAdSelector({
  brandId,
  selectedCompetitorAd,
  onSelect,
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

  if (!brandId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-black" />
          <span className="ml-2 text-sm text-[#666666]">Loading competitor ads...</span>
        </div>
      </div>
    );
  }

  if (competitorAds.length === 0) {
    return (
      <div className={`bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-6 ${className}`}>
        <div className="flex items-start gap-4">
          <Info className="w-5 h-5 text-black flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-black font-semibold">No competitor ads yet</p>
            <p className="text-sm text-[#666666] mt-2 leading-relaxed">
              Add competitor ads in the Assets page to use them as reference for your video generation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl overflow-hidden relative ${className}`}>
      {/* Header - Always visible */}
      <button
        ref={buttonRef}
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-black">
              Reference Competitor Ad
            </h3>
            <p className="text-sm text-[#666666] mt-0.5">
              {selectedCompetitorAd
                ? `Selected: ${selectedCompetitorAd.competitor_name}`
                : `${competitorAds.length} competitor ${competitorAds.length === 1 ? 'ad' : 'ads'} available`}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-black transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
            right: `${window.innerWidth - buttonRect.right}px`,
            bottom: `${window.innerHeight - buttonRect.top + 8}px`,
            maxHeight: '50vh',
          }}
          className="bg-white border border-[#E5E5E5] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.1)] overflow-hidden z-[110]"
        >
          <div className="p-6 pb-16 space-y-4 max-h-[50vh] overflow-y-auto">
            {/* Desktop: Grid View */}
            {!isMobile ? (
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
                        {/* Small Thumbnail */}
                        <div className="w-12 h-12 flex-shrink-0 bg-black rounded-lg overflow-hidden relative">
                          {ad.file_type === 'image' ? (
                            <Image
                              src={ad.ad_file_url}
                              alt={ad.competitor_name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6 4a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2H6zm1 9a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 11-2 0 1 1 0 012 0zm-5-5a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 11-2 0 1 1 0 012 0z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Ad Info */}
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-semibold text-black truncate">
                            {ad.competitor_name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[#666666]">{ad.platform}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${
                              ad.file_type === 'video'
                                ? 'bg-black text-white'
                                : 'bg-[#F7F7F7] text-black border border-[#E5E5E5]'
                            }`}>
                              {ad.file_type === 'video' ? 'Video' : 'Image'}
                            </span>
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
                        <div className="relative aspect-video bg-black rounded-xl overflow-hidden mb-4">
                          {ad.file_type === 'image' ? (
                            <Image
                              src={ad.ad_file_url}
                              alt={ad.competitor_name}
                              fill
                              className="object-contain"
                              sizes="(max-width: 768px) 100vw, 50vw"
                            />
                          ) : (
                            <video
                              src={ad.ad_file_url}
                              className="w-full h-full object-contain"
                              controls
                              playsInline
                            />
                          )}
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
            )}

            {/* Clear Selection Button */}
            {selectedCompetitorAd && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => onSelect(null)}
                  className="text-sm text-black hover:text-[#666666] underline font-medium"
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
