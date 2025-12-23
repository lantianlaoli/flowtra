'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, Target, RefreshCcw, Languages, BadgeCheck, AlertTriangle, Clock3, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompetitorAd } from '@/lib/supabase';
import { getLanguageDisplayInfo, isLanguageCode } from '@/lib/language';
import { type LanguageCode } from '@/components/ui/LanguageSelector';
import CompetitorShotsEditor from './CompetitorShotsEditor';
import { CompetitorShotForm, parseShotsFromAnalysis, sanitizeShotsForSave } from '@/lib/competitor-shot-form';

interface EditCompetitorAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitorAd: CompetitorAd | null;
  onCompetitorAdUpdated: (competitorAd: CompetitorAd) => void;
}

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
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAd, setCurrentAd] = useState<CompetitorAd | null>(competitorAd);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [shotsDraft, setShotsDraft] = useState<CompetitorShotForm[]>([]);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  // Load competitor ad data when modal opens
  useEffect(() => {
    if (isOpen && competitorAd) {
      setCompetitorName(competitorAd.competitor_name);
      setCurrentAd(competitorAd);
      setError(null);
      setAnalysisMessage(null);
      setShotsDraft([]);
      const normalizedLang = competitorAd.language && isLanguageCode(competitorAd.language) ? competitorAd.language : 'en';
      setSelectedLanguage(normalizedLang);
    }
  }, [isOpen, competitorAd]);

  useEffect(() => {
    if (currentAd?.analysis_result && typeof currentAd.analysis_result === 'object') {
      const analysisShots = (currentAd.analysis_result as Record<string, unknown>).shots;
      if (Array.isArray(analysisShots)) {
        setShotsDraft(parseShotsFromAnalysis(analysisShots));
        return;
      }
    }
    setShotsDraft([]);
  }, [currentAd]);

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
      if (languageMenuRef.current && !languageMenuRef.current.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUpdate = async () => {
    if (!currentAd) return;

    if (!competitorName.trim()) {
      setError('Competitor name is required');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const sanitizedShots = sanitizeShotsForSave(shotsDraft);
      const baseAnalysis =
        currentAd.analysis_result && typeof currentAd.analysis_result === 'object'
          ? currentAd.analysis_result
          : {};

      const response = await fetch(`/api/competitor-ads/${currentAd.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          competitor_name: competitorName.trim(),
          language: selectedLanguage,
          analysis_result: {
            ...baseAnalysis,
            shots: sanitizedShots
          }
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
  const selectedLanguageOption = useMemo(
    () => LANGUAGE_OPTIONS.find(opt => opt.value === selectedLanguage) ?? LANGUAGE_OPTIONS[0],
    [selectedLanguage]
  );
  const analysisStatus = currentAd?.analysis_status || 'pending';
  const analysisResult = currentAd?.analysis_result as Record<string, unknown> | null | undefined;

  // New structure: name, video_duration_seconds, shots[]
  const videoDuration = currentAd?.video_duration_seconds ?? (typeof analysisResult?.video_duration_seconds === 'number' ? analysisResult.video_duration_seconds : null);
  const shots = shotsDraft;
  const hasAnalysisData = Boolean(videoDuration !== null || shots.length > 0);

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
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Viral Video</h2>
                <p className="text-sm text-gray-600">Modify details or re-analyze</p>
              </div>
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
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                {showAnalysisSummary ? (
                  <div className="space-y-4">
                    {/* Summary info in one line */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Duration */}
                      {videoDuration !== null && (
                        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                          <span className="text-gray-900 font-semibold">Duration:</span>
                          <span className="font-bold text-black">{videoDuration}s</span>
                        </div>
                      )}

                      {/* Shots count */}
                      {shots.length > 0 && (
                        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                          <span className="text-gray-900 font-semibold">Shots:</span>
                          <span className="font-bold text-black">{shots.length}</span>
                        </div>
                      )}
                    </div>

                    <CompetitorShotsEditor
                      shots={shotsDraft}
                      onShotsChange={setShotsDraft}
                      showSummary={false}
                    />
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
                  <div className={`text-sm rounded-md p-2 ${analysisMessage.type === 'success' ? 'bg-gray-50 text-gray-700 border border-gray-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
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
                        <Loader2 className="w-4 h-4 text-black animate-spin" />
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
            <div className="w-full md:w-2/5 overflow-y-auto p-6 border-l border-gray-100">
              <div className="space-y-6">
                {/* Creative Name */}
                <div>
                  <label htmlFor="edit-competitor-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Video Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-competitor-name"
                    type="text"
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    placeholder="e.g., Lovevery Montessori Toy Spot"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black placeholder:text-gray-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-black transition-all"
                    disabled={isUpdating}
                    required
                  />
                </div>

                {/* Language */}
                <div ref={languageMenuRef} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Language (override detection)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLanguageMenuOpen(prev => !prev)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white flex items-center justify-between hover:border-gray-400 transition-all shadow-sm outline-none focus:ring-1 focus:ring-black focus:border-black"
                    disabled={isUpdating}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center border border-gray-200">
                        <span className="text-xs font-semibold text-black uppercase">{selectedLanguageOption.value}</span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-black">{selectedLanguageOption.label}</p>
                        <p className="text-[10px] text-gray-500">{selectedLanguageOption.native}</p>
                      </div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isLanguageMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className="relative">
                    {isLanguageMenuOpen && (
                      <div className="absolute left-0 right-0 top-full mt-2 border border-gray-200 rounded-lg bg-white shadow-xl divide-y divide-gray-100 max-h-72 overflow-y-auto z-10 overflow-hidden">
                        {LANGUAGE_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setSelectedLanguage(option.value);
                              setIsLanguageMenuOpen(false);
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors"
                          >
                            <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center border border-gray-200">
                              <span className="text-[10px] font-semibold text-black uppercase">{option.value}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-black">{option.label}</p>
                              <p className="text-[10px] text-gray-500">{option.native}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3 shrink-0">
             <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isUpdating || !competitorName.trim()}
              className="px-8 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm shadow-sm"
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
