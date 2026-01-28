'use client';

import { CompetitorAd } from '@/lib/supabase';
import { Edit2, Trash2, Loader2, BadgeCheck, AlertTriangle, Languages, Clock3, Video } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { getLanguageDisplayInfo } from '@/lib/language';

interface CompetitorAdCardProps {
  competitorAd: CompetitorAd;
  onEdit: (competitorAd: CompetitorAd) => void;
  onDelete: (id: string) => void;
  onSelect?: (competitorAd: CompetitorAd) => void;
  isSelected?: boolean;
  isDeleting?: boolean;
  mode?: 'manage' | 'select';
}

export default function CompetitorAdCard({
  competitorAd,
  onEdit,
  onDelete,
  onSelect,
  isSelected = false,
  isDeleting = false,
  mode = 'manage'
}: CompetitorAdCardProps) {
  const [showActions, setShowActions] = useState(false);
  const languageDisplay = getLanguageDisplayInfo(competitorAd.language);
  const analysisStatus = competitorAd.analysis_status || 'pending';
  const analysis = (competitorAd.analysis_result || null) as Record<string, unknown> | null;
  const previewVideoUrl = typeof analysis?.video_url === 'string'
    ? analysis.video_url
    : typeof analysis?.videoUrl === 'string'
      ? analysis.videoUrl
      : null;
  const previewCoverUrl = typeof analysis?.cover_url === 'string'
    ? analysis.cover_url
    : typeof analysis?.coverUrl === 'string'
      ? analysis.coverUrl
      : typeof analysis?.coverImageUrl === 'string'
        ? analysis.coverImageUrl
        : typeof analysis?.thumbnail_url === 'string'
          ? analysis.thumbnail_url
          : typeof analysis?.thumbnailUrl === 'string'
            ? analysis.thumbnailUrl
            : null;

  const renderAnalysisBadge = () => {
    const configMap = {
      completed: {
        label: 'Analyzed',
        className: 'bg-white text-black border-[#E5E5E5]',
        icon: BadgeCheck
      },
      analyzing: {
        label: 'Analyzing',
        className: 'bg-[#F7F7F7] text-[#666666] border-[#E5E5E5]',
        icon: Clock3
      },
      pending: {
        label: 'Pending',
        className: 'bg-[#F7F7F7] text-[#666666] border-[#E5E5E5]',
        icon: Clock3
      },
      failed: {
        label: 'Failed',
        className: 'bg-white text-black border-[#E5E5E5]',
        icon: AlertTriangle
      }
    } as const;

    const status = (analysisStatus in configMap ? analysisStatus : 'pending') as keyof typeof configMap;
    const config = configMap[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const handleClick = () => {
    if (mode === 'select' && onSelect) {
      onSelect(competitorAd);
    }
  };

  if (mode === 'select') {
    return (
      <div
        className={`
          group relative bg-white rounded-xl border transition-all
          cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]
          ${isSelected ? 'border-black ring-2 ring-black/20' : 'border-[#E5E5E5] hover:border-black/20'}
        `}
        onClick={handleClick}
      >
        {isSelected && (
          <div className="absolute top-2 right-2 bg-black text-white rounded-lg p-1 shadow-sm z-10">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        <div className="p-3">
          <div className="flex gap-3">
            <div className="h-20 w-14 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
              {previewVideoUrl ? (
                <video
                  src={previewVideoUrl}
                  poster={previewCoverUrl || undefined}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : previewCoverUrl ? (
                <Image
                  src={previewCoverUrl}
                  alt={competitorAd.competitor_name}
                  width={56}
                  height={80}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Video className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-black truncate">
                {competitorAd.competitor_name}
              </p>
              <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mt-2">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="w-3 h-3" />
                  {competitorAd.video_duration_seconds ? `${competitorAd.video_duration_seconds}s` : '--'}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Languages className="w-3 h-3" />
                  {languageDisplay?.label || '--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        group relative bg-white rounded-xl border transition-all
        ${isSelected ? 'border-black ring-2 ring-black/20' : 'border-[#E5E5E5] hover:border-black/20'}
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={handleClick}
    >
      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-black text-white rounded-lg p-1 shadow-sm z-10">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Info */}
      <div className="p-4 space-y-2">
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-semibold text-black text-sm truncate flex-1">
            {competitorAd.competitor_name}
          </h4>
          
          {/* Actions (Only in manage mode) */}
          {mode === 'manage' && !isDeleting && (
            <div className={`flex gap-1 transition-opacity duration-200 ${showActions ? 'opacity-100' : 'opacity-0'}`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(competitorAd);
                }}
                className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(competitorAd.id);
                }}
                className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
          {competitorAd.video_duration_seconds && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#E5E5E5] bg-white text-black font-medium text-[10px] uppercase tracking-wide">
              <Clock3 className="w-3 h-3 text-gray-400" />
              {competitorAd.video_duration_seconds}s
            </span>
          )}
          {languageDisplay && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#E5E5E5] bg-white text-black font-medium text-[10px] uppercase tracking-wide">
              <Languages className="w-3 h-3 text-gray-400" />
              {languageDisplay.label}
            </span>
          )}
        </div>
      </div>

      {/* Deleting Overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center backdrop-blur-sm rounded-xl">
          <Loader2 className="w-5 h-5 animate-spin text-black" />
        </div>
      )}
    </div>
  );
}
