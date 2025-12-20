'use client';

import { CompetitorAd } from '@/lib/supabase';
import { PlayCircle, Edit2, Trash2, Loader2, BadgeCheck, AlertTriangle, Languages, Clock3 } from 'lucide-react';
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
  const [videoError, setVideoError] = useState(false);
  const languageDisplay = getLanguageDisplayInfo(competitorAd.language);
  const analysisStatus = competitorAd.analysis_status || 'pending';

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

  return (
    <div
      className={`
        group relative bg-white rounded-xl border overflow-hidden transition-all
        ${mode === 'select' ? 'cursor-pointer hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]' : ''}
        ${isSelected ? 'border-black ring-2 ring-black/20' : 'border-[#E5E5E5] hover:border-black/20'}
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={handleClick}
    >
      {/* Media Preview */}
      <div className="relative aspect-video bg-black">
        {competitorAd.file_type === 'image' ? (
          <Image
            src={competitorAd.ad_file_url}
            alt={`${competitorAd.competitor_name} ad`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <>
            {!videoError ? (
              <video
                src={competitorAd.ad_file_url}
                className="w-full h-full object-contain"
                loop
                playsInline
                onMouseEnter={(e) => {
                  e.currentTarget.muted = false;
                  e.currentTarget.play();
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                  e.currentTarget.muted = true;
                }}
                onError={() => setVideoError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <PlayCircle className="w-12 h-12 text-gray-400" />
              </div>
            )}
          </>
        )}

        {/* Selected Indicator */}
        {isSelected && (
          <div className="absolute top-3 right-3 bg-black text-white rounded-lg p-1.5 shadow-lg">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-3">
        <h4 className="font-semibold text-black text-sm truncate">
          {competitorAd.competitor_name}
        </h4>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-lg bg-[#F7F7F7] text-[#666666] font-medium border border-[#E5E5E5]">
            {competitorAd.platform}
          </span>
          <span className={`
            px-2 py-1 rounded-lg font-medium
            ${competitorAd.file_type === 'video'
              ? 'bg-black text-white'
              : 'bg-white text-black border border-[#E5E5E5]'}
          `}>
            {competitorAd.file_type === 'video' ? 'Video' : 'Image'}
          </span>
          {competitorAd.file_type === 'video' && competitorAd.video_duration_seconds && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-black border border-[#E5E5E5] font-medium">
              <Clock3 className="w-3 h-3" />
              {competitorAd.video_duration_seconds}s
            </span>
          )}
          {languageDisplay && analysisStatus === 'completed' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F7F7F7] text-[#666666] border border-[#E5E5E5] font-medium">
              <Languages className="w-3 h-3" />
              {languageDisplay.label}
            </span>
          )}
          {renderAnalysisBadge()}
        </div>
      </div>

      {/* Actions (Only in manage mode) */}
      {mode === 'manage' && showActions && !isDeleting && (
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(competitorAd);
            }}
            className="bg-white/95 backdrop-blur-sm p-2 rounded-lg hover:bg-white transition-all shadow-lg border border-[#E5E5E5]"
            title="Edit"
          >
            <Edit2 className="w-4 h-4 text-black" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(competitorAd.id);
            }}
            className="bg-black/95 backdrop-blur-sm p-2 rounded-lg hover:bg-black transition-all shadow-lg"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Deleting Overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center backdrop-blur-sm">
          <Loader2 className="w-6 h-6 animate-spin text-black" />
        </div>
      )}
    </div>
  );
}
