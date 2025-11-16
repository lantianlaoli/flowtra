'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Target, Loader2, Info, ChevronRight } from 'lucide-react';
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
      <div className={`bg-purple-50 border border-purple-200 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="ml-2 text-sm text-purple-600">Loading competitor ads...</span>
        </div>
      </div>
    );
  }

  if (competitorAds.length === 0) {
    return (
      <div className={`bg-purple-50 border border-purple-200 rounded-xl p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-purple-900 font-medium">No competitor ads yet</p>
            <p className="text-xs text-purple-700 mt-1">
              Add competitor ads in the Assets page to use them as reference for your video generation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-purple-50 border border-purple-200 rounded-xl overflow-hidden relative ${className}`}>
      {/* Header - Always visible */}
      <button
        ref={buttonRef}
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-purple-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-600" />
          <div className="text-left">
            <h3 className="text-sm font-semibold text-purple-900">
              Reference Competitor Ad (Optional)
            </h3>
            <p className="text-xs text-purple-700">
              {selectedCompetitorAd
                ? `Selected: ${selectedCompetitorAd.competitor_name}`
                : `${competitorAds.length} competitor ${competitorAds.length === 1 ? 'ad' : 'ads'} available`}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-purple-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
          className="bg-white border border-purple-200 rounded-xl shadow-lg overflow-hidden z-[110]"
        >
          <div className="p-4">
            <div className="mb-3">
              <p className="text-xs text-gray-600">
                Select a competitor ad to use as creative reference. The AI will analyze its style and generate a similar ad for your product.
              </p>
            </div>

            {/* Desktop: Grid View */}
            {!isMobile ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto">
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
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {competitorAds.map((ad) => (
                  <div key={ad.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Compact Header - Always Visible */}
                    <button
                      onClick={() => toggleAdExpansion(ad.id)}
                      className="w-full px-3 py-2.5 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Small Thumbnail */}
                        <div className="w-12 h-12 flex-shrink-0 bg-gray-900 rounded overflow-hidden relative">
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
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {ad.competitor_name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">{ad.platform}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              ad.file_type === 'video'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {ad.file_type === 'video' ? 'Video' : 'Image'}
                            </span>
                          </div>
                        </div>

                        {/* Selected Indicator */}
                        {selectedCompetitorAd?.id === ad.id && (
                          <div className="flex-shrink-0 bg-blue-500 text-white rounded-full p-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Expand/Collapse Icon */}
                      <ChevronRight
                        className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-2 transition-transform ${
                          expandedAdId === ad.id ? 'rotate-90' : ''
                        }`}
                      />
                    </button>

                    {/* Expanded Preview - Only show when expanded */}
                    {expandedAdId === ad.id && (
                      <div className="border-t border-gray-200 bg-gray-50 p-3">
                        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-3">
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
                          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                            selectedCompetitorAd?.id === ad.id
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
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
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => onSelect(null)}
                  className="text-xs text-purple-600 hover:text-purple-800 underline"
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
