'use client';

import { useState, useEffect } from 'react';
import { Target, Loader2, Info } from 'lucide-react';
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

  useEffect(() => {
    if (brandId) {
      loadCompetitorAds();
    } else {
      setCompetitorAds([]);
      onSelect(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

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
    } else {
      onSelect(ad);
    }
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
    <div className={`bg-purple-50 border border-purple-200 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <button
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

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 border-t border-purple-200 bg-white">
          <div className="mb-3">
            <p className="text-xs text-gray-600">
              Select a competitor ad to use as creative reference. The AI will analyze its style and generate a similar ad for your product.
            </p>
          </div>

          {/* Competitor Ads Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
      )}
    </div>
  );
}
