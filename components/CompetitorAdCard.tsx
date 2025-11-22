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
        className: 'bg-green-50 text-green-700 border-green-200',
        icon: BadgeCheck
      },
      analyzing: {
        label: 'Analyzing',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        icon: Clock3
      },
      pending: {
        label: 'Pending',
        className: 'bg-gray-100 text-gray-700 border-gray-200',
        icon: Clock3
      },
      failed: {
        label: 'Failed',
        className: 'bg-red-50 text-red-700 border-red-200',
        icon: AlertTriangle
      }
    } as const;

    const status = (analysisStatus in configMap ? analysisStatus : 'pending') as keyof typeof configMap;
    const config = configMap[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.className}`}>
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
        group relative bg-white rounded-lg border-2 overflow-hidden transition-all
        ${mode === 'select' ? 'cursor-pointer hover:shadow-lg' : ''}
        ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'}
      `}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={handleClick}
    >
      {/* Media Preview */}
      <div className="relative aspect-video bg-gray-900">
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
          <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-3">
        <h4 className="font-medium text-gray-900 text-sm truncate">
          {competitorAd.competitor_name}
        </h4>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {competitorAd.platform}
          </span>
          <span className={`
            px-2 py-0.5 rounded-full
            ${competitorAd.file_type === 'video'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-blue-100 text-blue-700'}
          `}>
            {competitorAd.file_type === 'video' ? 'Video' : 'Image'}
          </span>
          {languageDisplay && analysisStatus === 'completed' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              <Languages className="w-3 h-3" />
              {languageDisplay.label}
            </span>
          )}
          {renderAnalysisBadge()}
        </div>
      </div>

      {/* Actions (Only in manage mode) */}
      {mode === 'manage' && showActions && !isDeleting && (
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(competitorAd);
            }}
            className="bg-white/90 backdrop-blur-sm p-1.5 rounded-lg hover:bg-white transition-colors shadow-sm"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5 text-gray-700" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(competitorAd.id);
            }}
            className="bg-white/90 backdrop-blur-sm p-1.5 rounded-lg hover:bg-white transition-colors shadow-sm"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
          </button>
        </div>
      )}

      {/* Deleting Overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
        </div>
      )}
    </div>
  );
}
