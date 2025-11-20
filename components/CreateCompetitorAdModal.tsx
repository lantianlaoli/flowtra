'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, Loader2, Target, CheckCircle, XCircle, ChevronDown, ChevronUp, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompetitorAd } from '@/lib/supabase';
import { getLanguageDisplayInfo } from '@/lib/language';
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

interface CreateCompetitorAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandId: string;
  brandName: string;
  onCompetitorAdCreated: (competitorAd: CompetitorAd) => void;
}

const PLATFORM_OPTIONS = [
  { value: 'Facebook', label: 'Facebook', icon: FaFacebookF, accent: 'text-[#0866ff]', bg: 'bg-[#e8f0ff]' },
  { value: 'Instagram', label: 'Instagram', icon: FaInstagram, accent: 'text-[#E1306C]', bg: 'bg-[#fce5ef]' },
  { value: 'TikTok', label: 'TikTok', icon: FaTiktok, accent: 'text-black', bg: 'bg-gray-100' },
  { value: 'YouTube', label: 'YouTube', icon: FaYoutube, accent: 'text-[#ff0000]', bg: 'bg-[#ffe6e6]' },
  { value: 'Twitter/X', label: 'Twitter / X', icon: FaXTwitter, accent: 'text-black', bg: 'bg-gray-100' },
  { value: 'LinkedIn', label: 'LinkedIn', icon: FaLinkedin, accent: 'text-[#0A66C2]', bg: 'bg-[#e6f0fb]' },
  { value: 'Snapchat', label: 'Snapchat', icon: FaSnapchat, accent: 'text-[#FFFC00]', bg: 'bg-[#fffad1]' },
  { value: 'Pinterest', label: 'Pinterest', icon: FaPinterestP, accent: 'text-[#E60023]', bg: 'bg-[#ffe5ea]' },
  { value: 'Other', label: 'Other', icon: LuGlobe, accent: 'text-gray-600', bg: 'bg-gray-100' }
] as const;

type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'failed';

export default function CreateCompetitorAdModal({
  isOpen,
  onClose,
  brandId,
  brandName,
  onCompetitorAdCreated
}: CreateCompetitorAdModalProps) {
  const router = useRouter();
  // Form state
  const [competitorName, setCompetitorName] = useState('');
  const [platform, setPlatform] = useState('Facebook');
  const [adFile, setAdFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);

  // API state
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Analysis state
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [analysisLanguage, setAnalysisLanguage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [createdAdId, setCreatedAdId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // UI state
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Polling ref
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCompetitorName('');
      setPlatform('Facebook');
      setAdFile(null);
      setFilePreview(null);
      setFileType(null);
      setError(null);
      setWarning(null);
      setAnalysisStatus('idle');
      setAnalysisResult(null);
      setAnalysisLanguage(null);
      setAnalysisError(null);
      setCreatedAdId(null);
      setExpandedSection(null);
    } else {
      // Clear polling when modal closes
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    }
  }, [isOpen]);

  // Handle ESC key - allow closing even during analysis
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Poll for analysis status
  useEffect(() => {
    if (createdAdId && analysisStatus === 'analyzing') {
      pollingInterval.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/competitor-ads/${createdAdId}`);
          const data = await response.json();

          if (data.success && data.competitorAd) {
            const ad = data.competitorAd;

            if (ad.analysis_status === 'completed') {
              setAnalysisStatus('completed');
              setAnalysisResult(ad.analysis_result);
              setAnalysisLanguage(ad.language || null);
              clearInterval(pollingInterval.current!);
              pollingInterval.current = null;
            } else if (ad.analysis_status === 'failed') {
              setAnalysisStatus('failed');
              setAnalysisError(ad.analysis_error);
              clearInterval(pollingInterval.current!);
              pollingInterval.current = null;
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000); // Poll every 3 seconds

      return () => {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }
      };
    }
  }, [createdAdId, analysisStatus]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        setError('Please upload an image or video file');
        return;
      }

      // Validate file size
      const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`File size must be less than ${isVideo ? '100MB' : '10MB'}`);
        return;
      }

      setAdFile(file);
      setFileType(isVideo ? 'video' : 'image');

      // Generate preview
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const canSelectFile = !isUploading && analysisStatus === 'idle';
  const triggerFileInput = () => {
    if (!canSelectFile) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!competitorName.trim()) {
      setError('Ad name is required');
      return;
    }

    if (!adFile) {
      setError('Advertisement file is required');
      return;
    }

    setIsUploading(true);
    setError(null);
    setWarning(null);

    try {
      const formData = new FormData();
      formData.append('brand_id', brandId);
      formData.append('competitor_name', competitorName.trim());
      formData.append('platform', platform);
      formData.append('ad_file', adFile);

      const response = await fetch('/api/competitor-ads', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        const ad = data.competitorAd;
        setCreatedAdId(ad.id);
        setAnalysisLanguage(ad.language || null);

        // Check immediate analysis status
        if (ad.analysis_status === 'analyzing') {
          setAnalysisStatus('analyzing');
        } else if (ad.analysis_status === 'completed') {
          setAnalysisStatus('completed');
          setAnalysisResult(ad.analysis_result);
          setAnalysisLanguage(ad.language || null);
        } else if (ad.analysis_status === 'failed') {
          setAnalysisStatus('failed');
          setAnalysisError(ad.analysis_error);
        }

        if (data.warning) {
          setWarning(data.warning);
        }

        onCompetitorAdCreated(ad);
      } else {
        setError(data.error || data.details || 'Failed to create competitor ad');
      }
    } catch (err) {
      console.error('Error creating competitor ad:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseWithAnalyzing = () => {
    if (analysisStatus === 'analyzing') {
      // Show toast or notification that analysis continues in background
      alert('✅ Competitor ad saved! Analysis is running in background.');
    }
    onClose();
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const languageDisplay = useMemo(() => getLanguageDisplayInfo(analysisLanguage), [analysisLanguage]);

  if (!isOpen) return null;

  const canClose = !isUploading;
  const canSubmit = !isUploading && competitorName.trim() && adFile;
  const hasUploadedAd = Boolean(createdAdId);

  const handleGoToStandardAds = () => {
    onClose();
    router.push('/dashboard/standard-ads');
  };

  return (
    <AnimatePresence>
      <input
        ref={fileInputRef}
        id="ad-file"
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileUpload}
        disabled={!canSelectFile}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => canClose && handleCloseWithAnalyzing()}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add Competitor Ad</h2>
                <p className="text-sm text-gray-600">For {brandName}</p>
              </div>
            </div>
            <button
              onClick={handleCloseWithAnalyzing}
              disabled={!canClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Two-Column Layout */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Column: Preview + Analysis (60%) */}
            <div className="w-full md:w-3/5 border-r border-gray-200 overflow-y-auto p-6 bg-gray-50">
              {!filePreview ? (
                <button
                  type="button"
                  onClick={triggerFileInput}
                  disabled={!canSelectFile}
                  className="w-full h-full min-h-[320px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl bg-white shadow-sm hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload className="w-14 h-14 text-gray-300 mb-4" />
                  <p className="text-lg font-medium text-gray-800 mb-2">Upload a file</p>
                  <p className="text-sm text-gray-500">Choose a competitor image or video to preview and analyze.</p>
                  <p className="text-xs text-gray-400 mt-3">
                    Images: max 10MB · Videos: max 100MB
                  </p>
                  {!canSelectFile && (
                    <p className="text-xs text-gray-500 mt-2">Finish the current upload before adding another file.</p>
                  )}
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Current file</p>
                      <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{adFile?.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      disabled={!canSelectFile}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Upload className="w-4 h-4" />
                      Replace file
                    </button>
                  </div>
                  {/* Media Preview */}
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {fileType === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    ) : (
                      <video
                        src={filePreview}
                        controls
                        className="w-full h-auto max-h-96 object-contain"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Supported formats: JPG, PNG, MP4, MOV, WEBM
                  </p>

                  {/* Analysis Progress */}
                  {analysisStatus === 'analyzing' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                        <h3 className="font-semibold text-gray-900">Analyzing ad structure...</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        AI is extracting creative elements, detecting language, and analyzing the ad structure. This may take 10-30 seconds.
                      </p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                      </div>
                    </div>
                  )}

                  {/* Analysis Complete */}
                  {analysisStatus === 'completed' && analysisResult && (
                    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <h3 className="font-semibold text-gray-900">Analysis Complete</h3>
                      </div>
                      {languageDisplay && (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                          <Languages className="w-4 h-4 text-gray-500" />
                          <span className="font-semibold text-gray-900">{languageDisplay.label}</span>
                          {languageDisplay.native && languageDisplay.native !== languageDisplay.label && (
                            <span className="text-gray-500">({languageDisplay.native})</span>
                          )}
                          <span className="text-xs uppercase tracking-wide text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                            {languageDisplay.code.toUpperCase()}
                          </span>
                          <span className="text-gray-500">detected</span>
                        </div>
                      )}

                      {/* 10 Veo Elements Display */}
                      <div className="space-y-3">
                        {(() => {
                          // Extract analysis data with type safety
                          const subject = String(analysisResult.subject || '');
                          const context = String(analysisResult.context || '');
                          const action = String(analysisResult.action || '');
                          const style = String(analysisResult.style || '');
                          const cameraMotion = String(analysisResult.camera_motion || '');
                          const composition = String(analysisResult.composition || '');
                          const ambiance = String(analysisResult.ambiance || '');
                          const audio = String(analysisResult.audio || '');
                          const firstFrame = String(analysisResult.first_frame_composition || '');

                          return (
                            <>
                              <AnalysisSection
                                title="Subject"
                                content={subject}
                                expanded={expandedSection === 'subject'}
                                onToggle={() => toggleSection('subject')}
                              />

                              <AnalysisSection
                                title="Context"
                                content={context}
                                expanded={expandedSection === 'context'}
                                onToggle={() => toggleSection('context')}
                              />

                              <AnalysisSection
                                title="Action"
                                content={action}
                                expanded={expandedSection === 'action'}
                                onToggle={() => toggleSection('action')}
                              />

                              <AnalysisSection
                                title="Style"
                                content={style}
                                expanded={expandedSection === 'style'}
                                onToggle={() => toggleSection('style')}
                              />

                              <AnalysisSection
                                title="Camera Motion"
                                content={cameraMotion}
                                expanded={expandedSection === 'camera_motion'}
                                onToggle={() => toggleSection('camera_motion')}
                              />

                              <AnalysisSection
                                title="Composition"
                                content={composition}
                                expanded={expandedSection === 'composition'}
                                onToggle={() => toggleSection('composition')}
                              />

                              <AnalysisSection
                                title="Ambiance"
                                content={ambiance}
                                expanded={expandedSection === 'ambiance'}
                                onToggle={() => toggleSection('ambiance')}
                              />

                              <AnalysisSection
                                title="Audio"
                                content={audio}
                                expanded={expandedSection === 'audio'}
                                onToggle={() => toggleSection('audio')}
                              />

                              {/* Scene Elements - handled outside IIFE */}

                              {/* First Frame Composition */}
                              <AnalysisSection
                                title="First Frame Composition"
                                content={firstFrame}
                                expanded={expandedSection === 'first_frame'}
                                onToggle={() => toggleSection('first_frame')}
                              />
                            </>
                          );
                        })()}

                        {/* Scene Elements */}
                        {Array.isArray(analysisResult.scene_elements) && analysisResult.scene_elements.length > 0 && (
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleSection('scene_elements')}
                              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                              <span className="font-medium text-sm text-gray-900">Scene Elements ({(analysisResult.scene_elements as unknown[]).length})</span>
                              {expandedSection === 'scene_elements' ? (
                                <ChevronUp className="w-4 h-4 text-gray-600" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                            {expandedSection === 'scene_elements' && (
                              <div className="p-3 space-y-2">
                                {(analysisResult.scene_elements as Array<{ element: string; position: string; details: string }>).map((el, idx) => (
                                  <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                                    <div className="font-medium text-sm text-gray-900">{el.element}</div>
                                    <div className="text-xs text-gray-600 mt-1">Position: {el.position}</div>
                                    <div className="text-sm text-gray-700 mt-1">{el.details}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Analysis Failed */}
                  {analysisStatus === 'failed' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <XCircle className="w-6 h-6 text-red-600" />
                        <h3 className="font-semibold text-gray-900">Analysis Failed</h3>
                      </div>
                      <p className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">
                        {analysisError || 'An error occurred during analysis'}
                      </p>
                      <p className="text-sm text-gray-600 mt-3">
                        The competitor ad has been saved, but analysis failed. You can retry analysis later from the Assets page.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Form (40%) */}
            <div className="w-full md:w-2/5 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Ad Name */}
                <div>
                  <label htmlFor="competitor-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Ad Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="competitor-name"
                    type="text"
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    placeholder="e.g., Summer Splash 15s"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isUploading || analysisStatus !== 'idle'}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use the actual title of the competitor advertisement so it&apos;s easy to find later.
                  </p>
                </div>

                {/* Platform */}
                <div>
                  <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Platform <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORM_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const isSelected = platform === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setPlatform(option.value)}
                          disabled={isUploading || analysisStatus !== 'idle'}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                            isSelected ? 'border-purple-500 bg-purple-50 text-purple-900' : 'border-gray-200 bg-white text-gray-800'
                          } ${isUploading || analysisStatus !== 'idle' ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-300'}`}
                          aria-pressed={isSelected}
                        >
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${option.bg}`}>
                            <Icon className={`w-4 h-4 ${option.accent}`} />
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium leading-tight">{option.label}</p>
                            <p className="text-[11px] text-gray-500">
                              {option.value === 'Other' ? 'Upload from other networks' : 'Optimized for this network'}
                            </p>
                          </div>
                          {isSelected && <CheckCircle className="w-4 h-4 text-purple-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Warning Message */}
                {warning && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                    {warning}
                  </div>
                )}

                {/* Actions */}
                {hasUploadedAd ? (
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={handleGoToStandardAds}
                      className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 font-semibold"
                    >
                      Recreate this competitor ad →
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={handleCloseWithAnalyzing}
                        disabled={!canClose}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {analysisStatus === 'analyzing' ? 'Save & Close' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={!canSubmit}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          'Upload & Analyze'
                        )}
                      </button>
                    </div>

                    {/* Background analysis notice */}
                    {analysisStatus === 'analyzing' && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-900">
                        💡 <strong>Tip:</strong> You can close this window. Analysis will continue in the background.
                      </div>
                    )}
                  </>
                )}
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// Analysis Section Component
function AnalysisSection({
  title,
  content,
  expanded,
  onToggle
}: {
  title: string;
  content: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const truncated = content.length > 80 ? content.slice(0, 80) + '...' : content;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-sm text-gray-900">{title}</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600" />
        )}
      </button>
      <div className="p-3">
        <p className="text-sm text-gray-700">
          {expanded ? content : truncated}
        </p>
      </div>
    </div>
  );
}
