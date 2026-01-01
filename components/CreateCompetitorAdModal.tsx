'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { X, Upload, Loader2, Target, CheckCircle, XCircle, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompetitorAd } from '@/lib/supabase';
import { getLanguageDisplayInfo } from '@/lib/language';
import CompetitorShotsEditor from './CompetitorShotsEditor';
import { CompetitorShotForm, parseShotsFromAnalysis } from '@/lib/competitor-shot-form';
import { uploadFileToSupabase } from '@/lib/upload-to-supabase';

interface CreateCompetitorAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandId: string;
  brandName: string;
  onCompetitorAdCreated: (competitorAd: CompetitorAd) => void;
}

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
  const [adFile, setAdFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);

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
  const [analysisStep, setAnalysisStep] = useState(0);
  const analysisSteps = [
    'Analyzing ad structure...',
    'Extracting creative elements...',
    'Detecting language...',
    'Identifying key shots...'
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (analysisStatus === 'analyzing') {
      interval = setInterval(() => {
        setAnalysisStep((prev) => (prev + 1) % analysisSteps.length);
      }, 3000);
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
      setError(null);
      setWarning(null);
      setAnalysisStatus('idle');
      setAnalysisResult(null);
      setAnalysisLanguage(null);
      setAnalysisError(null);
      setCreatedAdId(null);
      setShotsDraft([]);
      setAnalysisStep(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (analysisResult && typeof analysisResult === 'object' && Array.isArray((analysisResult as Record<string, unknown>).shots)) {
      setShotsDraft(parseShotsFromAnalysis((analysisResult as Record<string, unknown>).shots));
    } else {
      setShotsDraft([]);
    }
  }, [analysisResult]);


  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type - VIDEO ONLY
      const isVideo = file.type.startsWith('video/');

      if (!isVideo) {
        setError('Only video files are supported for competitor ads');
        return;
      }

      // Validate file size - 500 MB maximum
      const MAX_FILE_SIZE = 524288000; // 500 MB in bytes
      if (file.size > MAX_FILE_SIZE) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        setError(`File size exceeds 500 MB limit (${fileSizeMB} MB). Please compress your video.`);
        setCompressionLink('https://www.onlineconverter.com/compress-video');
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
                  <p className="text-lg font-medium text-gray-800 mb-2">Upload a video</p>
                  <p className="text-sm text-gray-500">Choose a viral video to preview and analyze.</p>
                  <p className="text-xs text-gray-400 mt-3">
                    Video files only • Max 500 MB • Max 80 seconds
                  </p>
                  {!canSelectFile && (
                    <p className="text-xs text-gray-500 mt-2">Finish the current upload before adding another file.</p>
                  )}
                </button>
              ) : (
                <div className="space-y-4">
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
                    Supported formats: MP4, MOV, WEBM (video only)
                  </p>

                  {/* Analysis Progress */}
                  {analysisStatus === 'analyzing' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-black animate-spin" />
                        <div className="h-6 overflow-hidden">
                          <AnimatePresence mode="wait">
                            <motion.h3
                              key={analysisStep}
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: -20, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="font-semibold text-gray-900"
                            >
                              {analysisSteps[analysisStep]}
                            </motion.h3>
                          </AnimatePresence>
                        </div>
                      </div>
                      <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <motion.div 
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 20, ease: "linear" }}
                          className="bg-black h-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Analysis Complete */}
                  {analysisStatus === 'completed' && analysisResult && (
                    <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle className="w-6 h-6 text-black" />
                        <h3 className="font-semibold text-gray-900">Analysis Complete</h3>
                      </div>

                      {/* One-line summary: Language, Duration, Shots */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Language */}
                        {languageDisplay && (
                          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                            <Languages className="w-4 h-4 text-gray-500" />
                            <span className="font-semibold text-gray-900">{languageDisplay.label}</span>
                            <span className="text-xs uppercase tracking-wide text-gray-500 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                              {languageDisplay.code.toUpperCase()}
                            </span>
                          </div>
                        )}

                        {/* Duration */}
                        {typeof analysisResult.video_duration_seconds === 'number' && (
                          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                            <span className="text-gray-900 font-semibold">Duration:</span>
                            <span className="font-bold text-black">
                              {analysisResult.video_duration_seconds}s
                            </span>
                          </div>
                        )}

                        {/* Shots count */}
                        {shotsDraft.length > 0 && (
                          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                            <span className="text-gray-900 font-semibold">Shots:</span>
                            <span className="font-bold text-black">
                              {shotsDraft.length}
                            </span>
                          </div>
                        )}
                      </div>

                      <CompetitorShotsEditor
                        shots={shotsDraft}
                        onShotsChange={setShotsDraft}
                        showSummary={false}
                      />
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
                        {compressionLink && (
                          <>
                            <br />
                            <span className="font-semibold">Please use a video compression website to process your video before uploading:</span>{' '}
                            <a href={compressionLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-red-800">
                              {compressionLink}
                            </a>
                          </>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setAnalysisStatus('idle');
                          setAnalysisError(null);
                          setAdFile(null);
                          setFilePreview(null);
                          setFileType(null);
                          setError(null);
                          setCompressionLink(null);
                        }}
                        className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Form (40%) */}
            <div className="w-full md:w-2/5 overflow-y-auto p-6">
              <form className="space-y-4">
                {/* Ad Name */}
                <div>
                  <label htmlFor="competitor-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Video Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="competitor-name"
                    type="text"
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    placeholder="AI will suggest a name after analysis..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                    disabled={isUploading || analysisStatus !== 'idle'}
                    required
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
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

                {/* Warning Message */}
                {warning && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">
                    {warning}
                  </div>
                )}
              </form>
            </div>
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
