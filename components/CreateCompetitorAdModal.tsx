'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, Loader2, Target, CheckCircle, XCircle, Languages, Sparkles, Film, Volume2, Maximize, AlertCircle, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompetitorAd } from '@/lib/supabase';
import { getLanguageDisplayInfo } from '@/lib/language';
import CompetitorShotsEditor from './CompetitorShotsEditor';
import { CompetitorShotForm, parseShotsFromAnalysis } from '@/lib/competitor-shot-form';
import { uploadFileToSupabase } from '@/lib/upload-to-supabase';
import {
  MAX_COMPETITOR_VIDEO_SIZE_BYTES,
  BASE64_SIZE_MULTIPLIER
} from '@/lib/constants';

interface CreateCompetitorAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandId: string;
  brandName: string;
  onCompetitorAdCreated: (competitorAd: CompetitorAd) => void;
}

type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'failed';

const LOADING_TIPS = [
  "Deconstructing narrative structure...",
  "Identifying camera movements...",
  "Analyzing lighting and color palettes...",
  "Extracting key dialogue and audio cues...",
  "Mapping shot transitions...",
];

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
  const [adFile, setAdFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);

  // Input mode state (NEW)
  const [inputMode, setInputMode] = useState<'file' | 'tiktok'>('file');
  const [tiktokUrl, setTiktokUrl] = useState('');

  // API state
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [compressionLink, setCompressionLink] = useState<string | null>(null);

  // Analysis state
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null);
  const [analysisLanguage, setAnalysisLanguage] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [createdAdId, setCreatedAdId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [shotsDraft, setShotsDraft] = useState<CompetitorShotForm[]>([]);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analysisStatus === 'analyzing') {
      interval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
      }, 3000);
    } else {
      setTipIndex(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analysisStatus]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCompetitorName('');
      setAdFile(null);
      setFilePreview(null);
      setFileType(null);
      setInputMode('file'); // Reset to file mode
      setTiktokUrl(''); // Clear TikTok URL
      setError(null);
      setWarning(null);
      setAnalysisStatus('idle');
      setAnalysisResult(null);
      setAnalysisLanguage(null);
      setAnalysisError(null);
      setCreatedAdId(null);
      setShotsDraft([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (analysisResult && typeof analysisResult === 'object' && Array.isArray((analysisResult as Record<string, unknown>).shots)) {
      setShotsDraft(parseShotsFromAnalysis((analysisResult as Record<string, unknown>).shots));
    } else {
      setShotsDraft([]);
    }
  }, [analysisResult]);


  // TikTok URL validation
  const isValidTikTokUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') {
      return false;
    }

    const patterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,  // Full URL
      /^https?:\/\/vm\.tiktok\.com\/[\w]+/                       // Short URL
    ];

    return patterns.some(pattern => pattern.test(url.trim()));
  };

  // Handle TikTok URL analysis
  const handleTikTokAnalyze = async () => {
    // Validate TikTok URL
    if (!isValidTikTokUrl(tiktokUrl)) {
      setError('Please enter a valid TikTok video URL (e.g., https://www.tiktok.com/@user/video/123)');
      return;
    }

    console.log('[CreateCompetitorAdModal] Starting TikTok video analysis...');
    setAnalysisStatus('analyzing');
    setIsUploading(true);
    setError(null);
    setWarning(null);

    try {
      // Step 1: Analyze the TikTok video (API handles fetching CDN URL)
      console.log('[CreateCompetitorAdModal] Step 1: Analyzing TikTok video with AI...');
      const analyzeResponse = await fetch('/api/competitor-ads/analyze-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tiktok_url: tiktokUrl,
          competitor_name: '' // Will use AI-generated name
        })
      });

      if (!analyzeResponse.ok) {
        const analyzeError = await analyzeResponse.json();
        throw new Error(analyzeError.error || analyzeError.details || 'TikTok video analysis failed');
      }

      const { analysis, language, video_url } = await analyzeResponse.json();
      console.log('[CreateCompetitorAdModal] ✅ Analysis complete');

      // Set video preview URL (TikTok CDN URL)
      if (video_url) {
        setFilePreview(video_url);
        setFileType('video');
      }

      // Extract AI-generated name from analysis
      const aiGeneratedName = (analysis && typeof analysis === 'object' && 'name' in analysis && typeof analysis.name === 'string')
        ? analysis.name
        : 'tiktok-video';

      // Step 2: Create database record with analysis results
      console.log('[CreateCompetitorAdModal] Step 2: Saving competitor ad...');
      console.log('[CreateCompetitorAdModal] brandId:', brandId);
      console.log('[CreateCompetitorAdModal] competitorName:', aiGeneratedName);

      const createResponse = await fetch('/api/competitor-ads/create-with-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand_id: brandId,
          competitor_name: aiGeneratedName,
          analysis_result: analysis,
          language: language,
          analysis_status: 'completed'
        })
      });

      if (!createResponse.ok) {
        const createError = await createResponse.json();
        throw new Error(createError.error || createError.details || 'Failed to save competitor ad');
      }

      const { competitorAd } = await createResponse.json();
      console.log('[CreateCompetitorAdModal] ✅ Record created, ID:', competitorAd.id);

      // Update UI state
      setCreatedAdId(competitorAd.id);
      setAnalysisStatus('completed');
      setAnalysisResult(analysis);
      setAnalysisLanguage(language);
      setCompetitorName(aiGeneratedName);

      onCompetitorAdCreated(competitorAd);

    } catch (err) {
      console.error('[CreateCompetitorAdModal] TikTok analysis error:', err);
      setAnalysisStatus('failed');
      setAnalysisError(err instanceof Error ? err.message : 'TikTok video analysis failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type - VIDEO ONLY
      const isVideo = file.type.startsWith('video/');

      if (!isVideo) {
        setError('Only video files are supported for competitor ads');
        return;
      }

      // Validate file size - 15 MB maximum (ensures Base64 stays under 20MB API limit)
      // Base64 encoding increases size by ~37%, so 15MB * 1.37 ≈ 20MB
      if (file.size > MAX_COMPETITOR_VIDEO_SIZE_BYTES) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const estimatedBase64MB = ((file.size * BASE64_SIZE_MULTIPLIER) / (1024 * 1024)).toFixed(2);
        const maxSizeMB = (MAX_COMPETITOR_VIDEO_SIZE_BYTES / (1024 * 1024)).toFixed(0);
        setError(
          `Video file too large (${fileSizeMB} MB, ~${estimatedBase64MB} MB after encoding). ` +
          `Maximum: ${maxSizeMB} MB to ensure AI analysis succeeds. Please compress your video first.`
        );
        setCompressionLink('https://www.onlineconverter.com/compress-video');
        setWarning('Tip: Most competitor ads are under 10 MB. Compress to improve upload speed.');
        return;
      }

      // Clear compression link if file size is valid
      setCompressionLink(null);

      // Validate video duration - 80 seconds maximum
      // Create temporary video element to read duration
      const videoElement = document.createElement('video');
      const videoUrl = URL.createObjectURL(file);

      const validateDuration = new Promise<boolean>((resolve) => {
        videoElement.onloadedmetadata = () => {
          URL.revokeObjectURL(videoUrl); // Clean up
          const duration = videoElement.duration;
          if (duration > 80) {
            setError(`Video duration must not exceed 1 minute 20 seconds (80 seconds). Current duration: ${Math.round(duration)}s. Please trim your video before uploading.`);
            resolve(false);
          } else {
            resolve(true);
          }
        };

        videoElement.onerror = () => {
          URL.revokeObjectURL(videoUrl); // Clean up on error
          setError('Unable to read video metadata. Please try a different file.');
          resolve(false);
        };

        videoElement.src = videoUrl;
      });

      const isDurationValid = await validateDuration;
      if (!isDurationValid) {
        return;
      }

      setAdFile(file);
      setFileType('video'); // Always video now

      // Generate preview
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);

      // Start analysis using new workflow
      console.log('[CreateCompetitorAdModal] Starting video analysis...');
      setAnalysisStatus('analyzing');
      setIsUploading(true);

      try {
        // Use file name (without extension) as temporary name
        const tempName = file.name.replace(/\.[^/.]+$/, '');

        // NEW WORKFLOW:
        // 1. Analyze video via /api/competitor-ads/analyze-preview (handles temp upload internally)
        // 2. Create record with analysis results via /api/competitor-ads/create-with-analysis
        // 3. No permanent file storage

        // Step 1: Upload video directly to Supabase (client-side upload, no API route)
        console.log('[CreateCompetitorAdModal] Step 1: Uploading video to storage...');
        const uploadPath = `temp_${Date.now()}_${file.name}`;

        const { publicUrl, path: uploadedPath } = await uploadFileToSupabase(
          file,
          'competitor_videos',
          uploadPath
        );

        console.log('[CreateCompetitorAdModal] ✅ Video uploaded:', publicUrl);

        // Step 2: Analyze the video (send URL instead of file)
        console.log('[CreateCompetitorAdModal] Step 2: Analyzing video with AI...');
        const analyzeResponse = await fetch('/api/competitor-ads/analyze-preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            file_url: publicUrl,
            uploaded_path: uploadedPath,
            competitor_name: tempName
          })
        });

        if (!analyzeResponse.ok) {
          const analyzeError = await analyzeResponse.json();
          throw new Error(analyzeError.error || analyzeError.details || 'Video analysis failed');
        }

        const { analysis, language } = await analyzeResponse.json();
        console.log('[CreateCompetitorAdModal] ✅ Analysis complete');

        // Extract AI-generated name from analysis before creating record
        const aiGeneratedName = (analysis && typeof analysis === 'object' && 'name' in analysis && typeof analysis.name === 'string')
          ? analysis.name
          : tempName;

        // Step 3: Create database record with analysis results
        console.log('[CreateCompetitorAdModal] Step 3: Saving competitor ad...');
        console.log('[CreateCompetitorAdModal] brandId:', brandId);
        console.log('[CreateCompetitorAdModal] competitorName:', aiGeneratedName);

        const createResponse = await fetch('/api/competitor-ads/create-with-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            brand_id: brandId,
            competitor_name: aiGeneratedName,
            analysis_result: analysis,
            language: language,
            analysis_status: 'completed'
          })
        });

        if (!createResponse.ok) {
          const createError = await createResponse.json();
          throw new Error(createError.error || createError.details || 'Failed to save competitor ad');
        }

        const { competitorAd } = await createResponse.json();
        console.log('[CreateCompetitorAdModal] ✅ Record created, ID:', competitorAd.id);

        // Update UI state
        setCreatedAdId(competitorAd.id);
        setAnalysisStatus('completed');
        setAnalysisResult(analysis);
        setAnalysisLanguage(language);

        // Set competitor name (same as what was saved to database)
        setCompetitorName(aiGeneratedName);

        onCompetitorAdCreated(competitorAd);

      } catch (err) {
        console.error('[CreateCompetitorAdModal] Error:', err);
        setAnalysisStatus('failed');
        setAnalysisError(err instanceof Error ? err.message : 'Upload and analysis failed');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCloseWithAnalyzing = () => {
    if (analysisStatus === 'analyzing') {
      const confirmed = confirm('Analysis is in progress. Are you sure you want to close? The ad has been saved and analysis will continue in the background.');
      if (!confirmed) return;
    }
    onClose();
  };

  const languageDisplay = useMemo(() => getLanguageDisplayInfo(analysisLanguage), [analysisLanguage]);

  const canClose = !isUploading;
  const showUGCButton = Boolean(createdAdId) && analysisStatus === 'completed';
  const canSelectFile = !isUploading && (analysisStatus === 'idle' || analysisStatus === 'failed');
  const isAnalyzing = analysisStatus === 'analyzing';

  const triggerFileInput = () => {
    if (!canSelectFile) {
      return;
    }
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  const handleGoToCompetitorUgcReplication = () => {
    onClose();
    router.push('/dashboard/competitor-ugc-replication');
  };

  return (
    <>
      <input
        ref={fileInputRef}
        id="ad-file"
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileUpload}
        disabled={!canSelectFile}
      />
      <AnimatePresence>
        {isOpen && (
          <div key="competitor-ad-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => canClose && handleCloseWithAnalyzing()}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          key="modal-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-black" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add Viral Video</h2>
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
            {/* Left Column */}
            <div 
              className={`
                ${!filePreview ? 'w-full' : 'w-full md:w-[45%] border-r border-gray-200'}
                overflow-y-auto p-6 bg-gray-50 transition-all duration-300 flex flex-col items-center justify-center
              `}
            >
              {!filePreview ? (
                <div className="h-full w-full flex flex-col gap-6">
                   {/* Error Display (moved from form) */}
                   {error && (
                    <div className="w-full bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                      <p>{error}</p>
                      {compressionLink && (
                        <p className="mt-2">
                          Please use a video compression website to process your video before uploading:{' '}
                          <a href={compressionLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-red-800">
                            {compressionLink}
                          </a>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex-1 flex flex-col md:flex-row gap-6 items-stretch">
                    {/* Option 1: File Upload */}
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={triggerFileInput}
                        disabled={!canSelectFile}
                        className="w-full h-full min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl bg-white shadow-sm hover:bg-gray-50 hover:border-black transition-all group disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-gray-100 transition-colors">
                            <Upload className="w-8 h-8 text-gray-400 group-hover:text-black transition-colors" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Video</h3>
                        <p className="text-sm text-gray-500 text-center px-4 mb-4">
                          Drag & drop or click to browse
                        </p>
                        <p className="text-xs text-gray-400">
                          MP4, MOV • Max 15 MB • 80s
                        </p>
                      </button>
                    </div>

                    {/* Divider with OR */}
                    <div className="relative flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center justify-center md:flex-col">
                            <div className="w-full h-px md:w-px md:h-full bg-gray-200"></div>
                        </div>
                        <span className="relative z-10 bg-gray-50 px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            OR
                        </span>
                    </div>

                    {/* Option 2: TikTok URL */}
                    <div className="flex-1 flex flex-col">
                        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
                             <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-8 h-8 text-black" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
                                </svg>
                             </div>
                             <h3 className="text-xl font-semibold text-gray-900 mb-6">Paste TikTok URL</h3>
                             
                             <div className="w-full space-y-3">
                                <input
                                  id="tiktok-url"
                                  type="url"
                                  placeholder="https://www.tiktok.com/@user/video/..."
                                  value={tiktokUrl}
                                  onChange={(e) => {
                                    setTiktokUrl(e.target.value);
                                    setError(null);
                                  }}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent text-sm"
                                  disabled={isUploading}
                                />
                                <button
                                  type="button"
                                  onClick={handleTikTokAnalyze}
                                  disabled={!tiktokUrl || isUploading}
                                  className="w-full px-4 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                  {isUploading ? (
                                    <>
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span>Analyzing...</span>
                                    </>
                                  ) : (
                                    <span>Analyze</span>
                                  )}
                                </button>
                             </div>
                        </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative w-full max-w-[320px] bg-black rounded-xl overflow-hidden shadow-lg ring-1 ring-black/5">
                    {fileType === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="w-full h-auto object-contain"
                      />
                    ) : (
                      <video
                        src={filePreview}
                        controls
                        className="w-full h-auto object-contain"
                      />
                    )}
                  </div>
                  
                  {/* Meta Badges */}
                  <div className="mt-6 flex gap-4 text-xs font-medium text-gray-500">
                    {analysisStatus === 'analyzing' ? (
                      // Skeleton Badges
                      <>
                        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                      </>
                    ) : (
                      // Real Badges
                      <>
                        {analysisResult && (typeof analysisResult.video_duration_seconds === 'number') && (
                          <div className="flex items-center gap-1.5">
                            <Film className="w-4 h-4" />
                            {analysisResult.video_duration_seconds}s
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Maximize className="w-4 h-4" />
                          9:16
                        </div>
                        {languageDisplay && (
                          <div className="flex items-center gap-1.5">
                            <Volume2 className="w-4 h-4" />
                            {languageDisplay.code.toUpperCase()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Right Column: Analysis/Result */}
            {filePreview && (
              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white">
                <div className="max-w-2xl mx-auto space-y-8">
                  
                  {/* Phase: Analyzing (Skeleton) */}
                  {analysisStatus === 'analyzing' && (
                    <div className="space-y-8">
                      {/* Header Info */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded-md border border-gray-200">
                            AI ANALYSIS
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date().toLocaleDateString()}
                          </span>
                        </div>
                        <div className="space-y-3">
                          <div className="h-8 w-3/4 bg-gray-100 rounded animate-pulse" />
                          <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
                          
                          {/* Analyzing Tip Overlay */}
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-4">
                            <Sparkles className="w-4 h-4 text-black animate-pulse" />
                            <span className="animate-pulse">{LOADING_TIPS[tipIndex]}</span>
                          </div>
                        </div>
                      </div>

                      {/* Shot List Skeleton */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                          Shot Breakdown
                        </h4>
                        <div className="space-y-3">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="p-4 rounded-xl border border-gray-100 bg-white space-y-3">
                              <div className="flex gap-4">
                                <div className="w-12 h-6 bg-gray-100 rounded animate-pulse" />
                                <div className="flex-1 space-y-2">
                                  <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
                                  <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
                                  <div className="h-3 w-5/6 bg-gray-100 rounded animate-pulse" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phase: Completed (Form + Results) */}
                  {analysisStatus === 'completed' && analysisResult && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      
                      {/* Status & Name Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <div className="w-5 h-5 bg-green-50 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                           </div>
                           <span className="text-xs font-bold text-green-600 uppercase tracking-widest">Analysis Complete</span>
                        </div>
                        
                        {/* Video Name Input - Minimalist & Editable */}
                        <div className="group relative">
                           <label htmlFor="competitor-name" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                              Video Name
                           </label>
                           <div className="relative flex items-center">
                              <input
                                 id="competitor-name"
                                 type="text"
                                 value={competitorName}
                                 onChange={(e) => setCompetitorName(e.target.value)}
                                 placeholder="Name your video..."
                                 className="w-full text-2xl font-bold bg-transparent border-none focus:ring-0 focus:outline-none p-0 pr-8 placeholder:text-gray-200 transition-all"
                                 disabled={isUploading}
                                 required
                              />
                              <Pencil className="absolute right-0 w-4 h-4 text-gray-300 group-hover:text-black group-focus-within:text-black transition-colors pointer-events-none" />
                           </div>
                           <div className="h-0.5 w-full bg-gray-100 group-hover:bg-gray-200 group-focus-within:bg-black transition-all duration-300 mt-1" />
                        </div>
                      </div>

                      {/* Analysis Stats Cards */}
                      <div className="grid grid-cols-3 gap-4">
                         <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition-colors">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Shots</span>
                            <span className="text-xl font-black text-black">{shotsDraft.length}</span>
                         </div>
                         <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition-colors">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</span>
                            <span className="text-xl font-black text-black">{(analysisResult as any).video_duration_seconds}s</span>
                         </div>
                         <div className="p-4 bg-gray-50/50 rounded-xl border border-gray-100 flex flex-col items-center justify-center gap-1 hover:bg-gray-50 transition-colors">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Language</span>
                            <span className="text-xl font-black text-black">{languageDisplay?.code.toUpperCase()}</span>
                         </div>
                      </div>

                      {/* Shot Editor */}
                      <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                           <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                             Shot Breakdown
                           </h4>
                        </div>
                        <CompetitorShotsEditor
                          shots={shotsDraft}
                          onShotsChange={setShotsDraft}
                          showSummary={false}
                        />
                      </div>
                    </div>
                  )}

                  {/* Phase: Failed */}
                  {analysisStatus === 'failed' && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                          <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Analysis Failed</h3>
                        <p className="text-gray-500 max-w-sm mb-6">{analysisError}</p>
                        
                        <button
                          onClick={() => {
                            setAnalysisStatus('idle');
                            setAdFile(null);
                            setFilePreview(null);
                            setFileType(null);
                            setError(null);
                            setCompressionLink(null);
                          }}
                          className="px-6 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                        >
                          Try Again
                        </button>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
            {showUGCButton ? (
              <button
                type="button"
                onClick={handleGoToCompetitorUgcReplication}
                className="w-full md:w-auto px-8 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 font-semibold"
              >
                Clone This Ad Now →
              </button>
            ) : isAnalyzing ? (
              <button
                type="button"
                onClick={handleCloseWithAnalyzing}
                disabled={!canClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCloseWithAnalyzing}
                  className="px-6 py-2 border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
        )}
      </AnimatePresence>
    </>
  );
}