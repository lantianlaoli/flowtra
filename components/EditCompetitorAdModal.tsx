'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, Target, RefreshCcw, Languages, BadgeCheck, AlertTriangle, Clock3, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompetitorAd } from '@/lib/supabase';
import { getLanguageDisplayInfo, isLanguageCode } from '@/lib/language';
import Image from 'next/image';
import { type LanguageCode } from '@/components/ui/LanguageSelector';
import {
  FaFacebookF,
  FaInstagram,
  FaTiktok,
  FaYoutube,
  FaXTwitter,
  FaLinkedin,
  FaSnapchat,
  FaPinterestP
} from 'react-icons/fa6';
import { LuGlobe } from 'react-icons/lu';
import { cn } from '@/lib/utils';

interface EditCompetitorAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitorAd: CompetitorAd | null;
  onCompetitorAdUpdated: (competitorAd: CompetitorAd) => void;
}

const PLATFORM_OPTIONS = [
  { value: 'Facebook', label: 'Facebook', icon: FaFacebookF, accent: 'text-[#0866ff]', bg: 'bg-[#e8f0ff]', helper: 'Landscape · 16:9' },
  { value: 'Instagram', label: 'Instagram', icon: FaInstagram, accent: 'text-[#E1306C]', bg: 'bg-[#fce5ef]', helper: 'Reels & Stories · 9:16' },
  { value: 'TikTok', label: 'TikTok', icon: FaTiktok, accent: 'text-black', bg: 'bg-gray-200', helper: 'Short-form · 9:16' },
  { value: 'YouTube', label: 'YouTube', icon: FaYoutube, accent: 'text-[#ff0000]', bg: 'bg-[#ffe6e6]', helper: 'Shorts · 16:9' },
  { value: 'Twitter/X', label: 'Twitter / X', icon: FaXTwitter, accent: 'text-black', bg: 'bg-gray-200', helper: 'Feeds · 16:9' },
  { value: 'LinkedIn', label: 'LinkedIn', icon: FaLinkedin, accent: 'text-[#0A66C2]', bg: 'bg-[#e6f0fb]', helper: 'Thought leadership' },
  { value: 'Snapchat', label: 'Snapchat', icon: FaSnapchat, accent: 'text-[#FFFC00]', bg: 'bg-[#fffad1]', helper: 'Stories · 9:16' },
  { value: 'Pinterest', label: 'Pinterest', icon: FaPinterestP, accent: 'text-[#E60023]', bg: 'bg-[#ffe5ea]', helper: 'Shopper inspiration' },
  { value: 'Other', label: 'Other', icon: LuGlobe, accent: 'text-gray-600', bg: 'bg-gray-200', helper: 'Custom placement' }
] as const;

const LANGUAGE_OPTIONS: Array<{ value: LanguageCode; label: string; native: string }> = [
  { value: 'en', label: 'English', native: 'English' },
  { value: 'zh', label: 'Chinese', native: 'Chinese' },
  { value: 'cs', label: 'Czech', native: 'Čeština' },
  { value: 'da', label: 'Danish', native: 'Dansk' },
  { value: 'nl', label: 'Dutch', native: 'Nederlands' },
  { value: 'fi', label: 'Finnish', native: 'Suomi' },
  { value: 'fr', label: 'French', native: 'Français' },
  { value: 'de', label: 'German', native: 'Deutsch' },
  { value: 'el', label: 'Greek', native: 'Ελληνικά' },
  { value: 'it', label: 'Italian', native: 'Italiano' },
  { value: 'no', label: 'Norwegian', native: 'Norsk' },
  { value: 'pl', label: 'Polish', native: 'Polski' },
  { value: 'pt', label: 'Portuguese', native: 'Português' },
  { value: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { value: 'ro', label: 'Romanian', native: 'Română' },
  { value: 'ru', label: 'Russian', native: 'Русский' },
  { value: 'es', label: 'Spanish', native: 'Español' },
  { value: 'sv', label: 'Swedish', native: 'Svenska' },
  { value: 'tr', label: 'Turkish', native: 'Türkçe' },
  { value: 'ur', label: 'Urdu', native: 'اردو' },
];

export default function EditCompetitorAdModal({
  isOpen,
  onClose,
  competitorAd,
  onCompetitorAdUpdated
}: EditCompetitorAdModalProps) {
  const [competitorName, setCompetitorName] = useState('');
  const [platform, setPlatform] = useState('Facebook');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAd, setCurrentAd] = useState<CompetitorAd | null>(competitorAd);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [isPlatformMenuOpen, setIsPlatformMenuOpen] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [expandedShots, setExpandedShots] = useState<Set<number>>(new Set());
  const platformMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  // Load competitor ad data when modal opens
  useEffect(() => {
    if (isOpen && competitorAd) {
      setCompetitorName(competitorAd.competitor_name);
      setPlatform(competitorAd.platform);
      setCurrentAd(competitorAd);
      setError(null);
      setAnalysisMessage(null);
      setExpandedShots(new Set());
      const normalizedLang = competitorAd.language && isLanguageCode(competitorAd.language) ? competitorAd.language : 'en';
      setSelectedLanguage(normalizedLang);
    }
  }, [isOpen, competitorAd]);

  const toggleShot = (shotId: number) => {
    setExpandedShots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(shotId)) {
        newSet.delete(shotId);
      } else {
        newSet.add(shotId);
      }
      return newSet;
    });
  };

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isUpdating) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isUpdating, onClose]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (platformMenuRef.current && !platformMenuRef.current.contains(event.target as Node)) {
        setIsPlatformMenuOpen(false);
      }
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentAd) return;

    if (!competitorName.trim()) {
      setError('Competitor name is required');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/competitor-ads/${currentAd.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          competitor_name: competitorName.trim(),
          platform: platform,
          language: selectedLanguage
        })
      });

      const data = await response.json();

      if (response.ok) {
        onCompetitorAdUpdated(data.competitorAd);
        onClose();
      } else {
        setError(data.error || data.details || 'Failed to update competitor ad');
      }
    } catch (err) {
      console.error('Error updating competitor ad:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReanalyze = async () => {
    if (!currentAd || isReanalyzing) return;

    try {
      setIsReanalyzing(true);
      setAnalysisMessage(null);
      const response = await fetch(`/api/competitor-ads/${currentAd.id}/reanalyze`, {
        method: 'POST'
      });
      const data = await response.json();

      if (response.ok && data.competitorAd) {
        setCurrentAd(data.competitorAd);
        onCompetitorAdUpdated(data.competitorAd);
        setAnalysisMessage({ type: 'success', text: 'Analysis completed successfully.' });
        if (data.competitorAd.language && isLanguageCode(data.competitorAd.language)) {
          setSelectedLanguage(data.competitorAd.language);
        }
      } else {
        setAnalysisMessage({
          type: 'error',
          text: data.error || data.details || 'Failed to run analysis. Please try again.'
        });
      }
    } catch (err) {
      console.error('Error re-analyzing competitor ad:', err);
      setAnalysisMessage({
        type: 'error',
        text: 'An unexpected error occurred while analyzing the ad.'
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const languageDisplay = getLanguageDisplayInfo(selectedLanguage);
  const selectedPlatformOption = useMemo(() => {
    const option = PLATFORM_OPTIONS.find(opt => opt.value === platform);
    if (option) return option;
    return {
      value: platform,
      label: platform || 'Custom',
      icon: LuGlobe,
      accent: 'text-gray-600',
      bg: 'bg-gray-200',
      helper: 'Custom placement'
    };
  }, [platform]);
  const selectedLanguageOption = useMemo(
    () => LANGUAGE_OPTIONS.find(opt => opt.value === selectedLanguage) ?? LANGUAGE_OPTIONS[0],
    [selectedLanguage]
  );
  const analysisStatus = currentAd?.analysis_status || 'pending';
  const analysisResult = currentAd?.analysis_result as Record<string, unknown> | null | undefined;

  // New structure: name, video_duration_seconds, shots[]
  const adName = typeof analysisResult?.name === 'string' ? analysisResult.name : '';
  const videoDuration = typeof analysisResult?.video_duration_seconds === 'number' ? analysisResult.video_duration_seconds : null;
  const shots = Array.isArray(analysisResult?.shots) ? analysisResult.shots : [];
  const hasAnalysisData = Boolean(adName || videoDuration !== null || shots.length > 0);

  const showAnalysisSummary = analysisStatus === 'completed' && hasAnalysisData;

  if (!isOpen || !competitorAd || !currentAd) return null;

  const renderStatusBadge = () => {
    const configMap = {
      completed: {
        label: 'Analyzed',
        className: 'bg-green-50 text-green-700 border-green-200',
        Icon: BadgeCheck
      },
      analyzing: {
        label: 'Analyzing',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
        Icon: Clock3
      },
      pending: {
        label: 'Pending',
        className: 'bg-gray-100 text-gray-700 border-gray-200',
        Icon: Clock3
      },
      failed: {
        label: 'Failed',
        className: 'bg-red-50 text-red-700 border-red-200',
        Icon: AlertTriangle
      }
    } as const;

    const status = (analysisStatus in configMap ? analysisStatus : 'pending') as keyof typeof configMap;
    const { label, className, Icon } = configMap[status];

    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${className}`}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
    );
  };

  const SelectedPlatformIcon = selectedPlatformOption.icon;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isUpdating && onClose()}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Competitor Ad</h2>
            </div>
            <button
              onClick={onClose}
              disabled={isUpdating}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left column */}
            <div className="w-full md:w-3/5 border-b md:border-b-0 md:border-r border-gray-200 overflow-y-auto bg-gray-50 p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Ad Preview</p>
                    <p className="text-xs text-gray-500">Current creative reference file</p>
                  </div>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full
                    ${currentAd.file_type === 'video'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'}
                  `}>
                    {currentAd.file_type === 'video' ? 'Video' : 'Image'}
                  </span>
                </div>
                <div className="mt-3 bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="relative aspect-video bg-black/80">
                    {currentAd.file_type === 'image' ? (
                      <Image
                        src={currentAd.ad_file_url}
                        alt={`${currentAd.competitor_name} ad`}
                        fill
                        className="object-contain"
                      />
                    ) : (
                      <video
                        src={currentAd.ad_file_url}
                        controls
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Analysis Status</p>
                    <p className="text-xs text-gray-500">View and refresh the AI-generated summary.</p>
                  </div>
                  {renderStatusBadge()}
                </div>

                {languageDisplay && (
                  <div className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    <Languages className="w-3.5 h-3.5" />
                    <span className="font-medium">{languageDisplay.label}</span>
                    {languageDisplay.native && languageDisplay.native !== languageDisplay.label && (
                      <span className="text-gray-500">({languageDisplay.native})</span>
                    )}
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">
                      {languageDisplay.code.toUpperCase()}
                    </span>
                  </div>
                )}

                {showAnalysisSummary ? (
                  <div className="space-y-4">
                    {/* Summary info in one line */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Ad Name */}
                      {adName && (
                        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                          <span className="font-semibold text-gray-900">{adName}</span>
                        </div>
                      )}

                      {/* Duration */}
                      {videoDuration !== null && (
                        <div className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-sm">
                          <span className="text-purple-600 font-semibold">Duration:</span>
                          <span className="font-bold text-purple-900">{videoDuration}s</span>
                        </div>
                      )}

                      {/* Shots count */}
                      {shots.length > 0 && (
                        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                          <span className="text-blue-600 font-semibold">Shots:</span>
                          <span className="font-bold text-blue-900">{shots.length}</span>
                        </div>
                      )}
                    </div>

                    {/* Shot details - expandable list */}
                    {shots.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          Shot Timeline
                        </h4>
                        <div className="space-y-2">
                          {(shots as Array<{
                            shot_id: number;
                            start_time: string;
                            end_time: string;
                            duration_seconds: number;
                            first_frame_description: string;
                            subject: string;
                            context_environment: string;
                            action: string;
                            style: string;
                            camera_motion_positioning: string;
                            composition: string;
                            ambiance_colour_lighting: string;
                            audio: string;
                            narrative_goal: string;
                            recommended_segment_duration: number;
                            generation_guidance: string;
                            contains_brand?: boolean;
                            contains_product?: boolean;
                          }>).map((shot) => {
                            const isExpanded = expandedShots.has(shot.shot_id);
                            return (
                              <div
                                key={shot.shot_id}
                                className="border border-gray-200 rounded-lg overflow-hidden bg-white"
                              >
                                {/* Shot header - always visible */}
                                <button
                                  type="button"
                                  onClick={() => toggleShot(shot.shot_id)}
                                  className="w-full flex items-center justify-between p-2 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="bg-blue-100 text-blue-700 font-bold text-xs rounded px-2 py-1">
                                      Shot {shot.shot_id}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {shot.start_time} – {shot.end_time}
                                    </div>
                                    <div className="text-xs font-medium text-gray-700">
                                      {shot.duration_seconds}s
                                    </div>
                                    {/* Brand indicator */}
                                    {shot.contains_brand && (
                                      <div className="flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded px-1.5 py-0.5">
                                        <BadgeCheck className="w-3 h-3" />
                                        Brand
                                      </div>
                                    )}
                                    {/* Product indicator */}
                                    {shot.contains_product && (
                                      <div className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-semibold rounded px-1.5 py-0.5">
                                        <Target className="w-3 h-3" />
                                        Product
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">{isExpanded ? 'Hide' : 'Show'}</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 text-gray-600" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-gray-600" />
                                    )}
                                  </div>
                                </button>

                                {/* Shot details - expandable */}
                                {isExpanded && (
                                  <div className="px-2 pb-2 space-y-2 border-t border-gray-100">
                                    <ShotField label="Narrative Goal" value={shot.narrative_goal} />
                                    <ShotField label="First Frame" value={shot.first_frame_description} />
                                    <ShotField label="Subject" value={shot.subject} />
                                    <ShotField label="Action" value={shot.action} />
                                    <ShotField label="Context/Environment" value={shot.context_environment} />
                                    <ShotField label="Style" value={shot.style} />
                                    <ShotField label="Camera Motion" value={shot.camera_motion_positioning} />
                                    <ShotField label="Composition" value={shot.composition} />
                                    <ShotField label="Lighting/Ambiance" value={shot.ambiance_colour_lighting} />
                                    <ShotField label="Audio" value={shot.audio} />
                                    <ShotField label="Generation Guidance" value={shot.generation_guidance} highlight />
                                    <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                      <span className="font-semibold">Recommended Duration:</span>
                                      <span>{shot.recommended_segment_duration}s</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    {analysisStatus === 'failed'
                      ? 'Analysis failed. Use the button below to retry.'
                      : 'Analysis results will appear here once processing completes.'}
                  </p>
                )}

                {analysisStatus === 'failed' && currentAd.analysis_error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                    {currentAd.analysis_error}
                  </div>
                )}

                {analysisMessage && (
                  <div className={`text-sm rounded-md p-2 ${analysisMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {analysisMessage.text}
                  </div>
                )}

                {/* Only show Re-run analysis button if no analysis data exists or analysis failed */}
                {(!hasAnalysisData || analysisStatus === 'failed') && (
                  <button
                    type="button"
                    onClick={handleReanalyze}
                    disabled={isReanalyzing || analysisStatus === 'analyzing'}
                    className="inline-flex items-center justify-center gap-2 w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isReanalyzing || analysisStatus === 'analyzing' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {analysisStatus === 'analyzing' ? 'Analysis in progress...' : 'Running analysis...'}
                      </>
                    ) : (
                      <>
                        <RefreshCcw className="w-4 h-4" />
                        {analysisStatus === 'completed' ? 'Re-run analysis' : 'Run analysis'}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="w-full md:w-2/5 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Creative Name */}
                <div>
                  <label htmlFor="edit-competitor-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Creative Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-competitor-name"
                    type="text"
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    placeholder="e.g., Lovevery Montessori Toy Spot"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isUpdating}
                    required
                  />
                </div>

                {/* Platform */}
                <div ref={platformMenuRef} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Platform <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPlatformMenuOpen(prev => !prev)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white flex items-center justify-between hover:border-gray-300 transition-colors shadow-sm"
                    disabled={isUpdating}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', selectedPlatformOption.bg)}>
                        <SelectedPlatformIcon className={cn('w-4 h-4', selectedPlatformOption.accent)} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">{selectedPlatformOption.label}</p>
                        <p className="text-xs text-gray-500">{selectedPlatformOption.helper}</p>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isPlatformMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className="relative">
                    {isPlatformMenuOpen && (
                      <div className="absolute left-0 right-0 border border-gray-200 rounded-xl bg-white shadow-xl divide-y divide-gray-100 max-h-72 overflow-y-auto z-10">
                        {PLATFORM_OPTIONS.map(option => {
                          const OptionIcon = option.icon;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setPlatform(option.value);
                                setIsPlatformMenuOpen(false);
                              }}
                              className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 text-left"
                            >
                              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', option.bg)}>
                                <OptionIcon className={cn('w-4 h-4', option.accent)} />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{option.label}</p>
                                <p className="text-xs text-gray-500">{option.helper}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Language */}
                <div ref={languageMenuRef} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Language (override detection)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLanguageMenuOpen(prev => !prev)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white flex items-center justify-between hover:border-gray-300 transition-colors shadow-sm"
                    disabled={isUpdating}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-gray-700 uppercase">{selectedLanguageOption.value}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-900">{selectedLanguageOption.label}</p>
                        <p className="text-xs text-gray-500">{selectedLanguageOption.native}</p>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isLanguageMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className="relative">
                    {isLanguageMenuOpen && (
                      <div className="absolute left-0 right-0 border border-gray-200 rounded-xl bg-white shadow-xl divide-y divide-gray-100 max-h-72 overflow-y-auto z-10">
                        {LANGUAGE_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setSelectedLanguage(option.value);
                              setIsLanguageMenuOpen(false);
                            }}
                            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 text-left"
                          >
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                              <span className="text-xs font-semibold text-gray-700 uppercase">{option.value}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{option.label}</p>
                              <p className="text-xs text-gray-500">{option.native}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Click “Run analysis” to refresh the detected language or adjust it manually here.
                  </p>
                </div>

                {/* Info Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    Note: You cannot change the advertisement file. To use a different file, please delete this ad and create a new one.
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isUpdating}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating || !competitorName.trim()}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Shot field display component
function ShotField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`text-xs ${highlight ? 'bg-blue-50 border border-blue-200 rounded p-2' : ''}`}>
      <div className="font-semibold text-gray-700 text-[10px] uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`${highlight ? 'text-blue-900' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
