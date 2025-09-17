'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useWorkflowV2 } from '@/hooks/useWorkflowV2';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import FileUpload from '@/components/FileUpload';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import { RotateCcw, ArrowRight, History, Play, Image as ImageIcon, Hash, Type, Square, ChevronDown, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
// Removed cost display; no need to import CREDIT_COSTS here

export default function GenerateAdPageV2() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, refetchCredits } = useCredits();
  const [selectedModel, setSelectedModel] = useState<'veo3' | 'veo3_fast'>('veo3_fast');
  const [elementsCount, setElementsCount] = useState(2);
  const [textWatermark, setTextWatermark] = useState('');
  const [textWatermarkLocation, setTextWatermarkLocation] = useState('bottom left');
  const [imageSize, setImageSize] = useState('auto');
  const router = useRouter();
  const [kieCreditsStatus, setKieCreditsStatus] = useState<{ sufficient: boolean; loading: boolean; currentCredits?: number; threshold?: number }>({
    sufficient: true,
    loading: true
  });

  // Silky overlay messages for generation flow
  const overlayMessages = [
    'Sketching cover compositions…',
    'Exploring multiple creative directions…',
    'Choosing lenses, framing, and timing…',
    'Designing camera moves and transitions…',
    'Polishing color and lighting — almost there…'
  ];
  const [overlayIndex, setOverlayIndex] = useState(0);
  
  const {
    state,
    uploadFile,
    startBatchWorkflow,
    downloadContent,
    resetWorkflow
  } = useWorkflowV2(user?.id, selectedModel, elementsCount, textWatermark, textWatermarkLocation, imageSize);

  const handleModelChange = (model: 'auto' | 'veo3' | 'veo3_fast') => {
    if (model === 'auto') {
      setSelectedModel('veo3_fast'); // Default for auto
    } else {
      setSelectedModel(model);
    }
  };

  // Note: keep hooks above; render loading UI later to avoid conditional hooks

  const handleFileUpload = async (files: File | File[]) => {
    const fileArray = Array.isArray(files) ? files : [files];
    
    if (fileArray.length > 0) {
      await uploadFile(fileArray[0]);
    }
  };

  const handleStartWorkflow = async () => {
    try {
      await startBatchWorkflow();
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  const handleDownload = async (instanceId: string, contentType: 'cover' | 'video') => {
    try {
      await downloadContent(instanceId, contentType);
      await refetchCredits(); // Refresh credits after download
    } catch (error) {
      console.error('Download failed:', error);
      alert(error instanceof Error ? error.message : 'Download failed');
    }
  };

  // Check KIE credits on page load (maintenance check)
  useEffect(() => {
    const checkKieCredits = async () => {
      try {
        const response = await fetch('/api/check-kie-credits');
        const result = await response.json();
        setKieCreditsStatus({
          sufficient: result.success && result.sufficient,
          loading: false,
          currentCredits: result.currentCredits,
          threshold: result.threshold
        });
      } catch (error) {
        console.error('Failed to check KIE credits:', error);
        setKieCreditsStatus({ sufficient: false, loading: false });
      }
    };
    checkKieCredits();
  }, []);

  // Removed unused getProgressPercentage helper to satisfy lint

  // Cycle overlay messages while generating in 'uploaded' state
  useEffect(() => {
    const showOverlay = state.workflowStatus === 'uploaded' && state.isLoading;
    if (!showOverlay) return;

    setOverlayIndex(0);
    const interval = setInterval(() => {
      setOverlayIndex((idx) => (idx + 1) % overlayMessages.length);
    }, 2600);

    return () => clearInterval(interval);
  }, [state.workflowStatus, state.isLoading, overlayMessages.length]);

  const v2Highlights = [
    {
      label: 'Ideal for',
      description: 'Creative testing, prospecting ads, and campaigns exploring new visual directions.'
    },
    {
      label: 'What you get',
      description: 'Multiple video variations generated from one product photo with distinct pacing and tone.'
    },
    {
      label: 'Best used when',
      description: 'You need stylistic experimentation to compare hooks, copy angles, or motion concepts before scaling spend.'
    }
  ];

  const renderWorkflowContent = () => {
    // Maintenance: insufficient KIE credits
    if (!kieCreditsStatus.loading && !kieCreditsStatus.sufficient) {
      return (
        <div className="max-w-xl mx-auto">
          <MaintenanceMessage />
        </div>
      );
    }
    // Show upload interface when idle
    if (state.workflowStatus === 'idle') {
      return (
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  Designed for creative exploration
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Drop in a single photo and compare multiple motion-first storylines. Each variation treats your product as the hero while experimenting with composition, copy, and color grading.
                </p>
              </div>
              <div className="space-y-3">
                {v2Highlights.map((item) => (
                  <div key={item.label} className="border border-gray-200 rounded-lg p-4 bg-gray-50/60">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">
                      {item.label}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
              <FileUpload onFileUpload={handleFileUpload} isLoading={state.isLoading} multiple={false} />
            </div>
          </div>
        </div>
      );
    }

    // Show configuration interface after upload
    if (state.workflowStatus === 'uploaded') {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side - Image Preview only (fit viewport) */}
            <div className="space-y-6">
              {state.uploadedFile?.url && (
                <div className="text-center">
                  <Image 
                    src={state.uploadedFile.url} 
                    alt="Product" 
                    width={500}
                    height={500}
                    className="w-full h-auto max-h-[75vh] object-contain rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* Right Side - Configuration Area */}
            <div className="space-y-4">
              
              {/* Elements Count Selector - segmented control */}
              <div>
                <label className="flex items-center gap-2 text-base font-medium text-gray-900 mb-3">
                  <Hash className="w-4 h-4" />
                  Ads
                </label>
                <div
                  role="radiogroup"
                  aria-label="How many ads?"
                  className="relative inline-flex rounded-xl border border-gray-300 bg-white p-1 shadow-sm"
                >
                  {[1,2,3].map((val) => {
                    const active = elementsCount === val;
                    return (
                      <button
                        key={val}
                        role="radio"
                        aria-checked={active}
                        onClick={() => setElementsCount(val)}
                        className={`relative px-5 py-2.5 text-base font-semibold rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                          active ? 'text-white' : 'text-gray-800 hover:bg-gray-50'
                        } ${val !== 1 ? 'ml-1' : ''}`}
                      >
                        {active && (
                          <motion.div
                            layoutId="segmentedHighlight"
                            className="absolute inset-0 rounded-lg bg-gray-900 shadow z-0"
                            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                          />
                        )}
                        <span className="relative z-10">
                          {val} {val === 1 ? 'ad' : 'ads'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Watermark Configuration */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-base font-medium text-gray-900">
                  <Type className="w-4 h-4" />
                  Watermark
                </label>

                {/* Watermark Text Input and Location Selector - Left Right Layout */}
                <div className="flex gap-3">
                  {/* Left: Text Input */}
                  <div className="flex-1">
                    <input
                      id="watermark-text"
                      type="text"
                      value={textWatermark}
                      onChange={(e) => setTextWatermark(e.target.value)}
                      placeholder="Enter watermark text (optional)..."
                      maxLength={50}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm shadow-sm"
                    />
                  </div>

                  {/* Right: Location Selector with Custom Dropdown */}
                  <div className="relative w-32">
                    <select
                      id="watermark-location"
                      value={textWatermarkLocation}
                      onChange={(e) => setTextWatermarkLocation(e.target.value)}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white text-sm shadow-sm appearance-none cursor-pointer"
                    >
                      <option value="bottom left">Bottom Left</option>
                      <option value="bottom right">Bottom Right</option>
                      <option value="top left">Top Left</option>
                      <option value="top right">Top Right</option>
                      <option value="center bottom">Center Bottom</option>
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Image Size Configuration */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-base font-medium text-gray-900">
                  <Square className="w-4 h-4" />
                  Size
                </label>

                <div className="relative">
                  <select
                    id="image-size"
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value)}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white text-sm shadow-sm appearance-none cursor-pointer"
                  >
                    <option value="auto">Auto (Native Resolution)</option>
                    <option value="1:1">Square (1:1)</option>
                    <option value="3:4">Portrait 3:4</option>
                    <option value="9:16">Portrait 9:16</option>
                    <option value="4:3">Landscape 4:3</option>
                    <option value="16:9">Landscape 16:9</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons moved to right side */}
              <div className="space-y-3">
                <button
                  onClick={handleStartWorkflow}
                  disabled={state.isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium relative overflow-hidden group"
                >
                  {state.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Generating…</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                      <span className="group-hover:scale-105 transition-transform duration-200">Generate</span>
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Free</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        handleFileUpload(file);
                      }
                    };
                    input.click();
                  }}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium"
                >
                  <RotateCcw className="w-4 h-4" />
                  Change Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show simple started state (Notion style) instead of progress page
    if (state.workflowStatus === 'processing') {
      return (
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-medium text-gray-900">Ad Creation Started</h3>
            <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
              Your ads are being generated in the background. You can view progress in My Ads.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/dashboard/videos')}
              className="flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium cursor-pointer"
            >
              <History className="w-4 h-4" />
              View Progress
            </button>
            <button
              onClick={() => resetWorkflow()}
              className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              Create Another
            </button>
          </div>
        </div>
      );
    }

    // Show completed state with results
    if (state.workflowStatus === 'completed') {
      return (
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900">
              Your ad variations are ready!
            </h3>
            <p className="text-gray-600 text-lg">
              {elementsCount} unique creative approaches for your product
            </p>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {state.instances.map((instance) => (
              <div key={instance.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Variation</h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {instance.status === 'completed' ? (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">Ready</span>
                      ) : instance.status === 'failed' ? (
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full">Failed</span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Processing</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  {/* Cover Image */}
                  {instance.cover_image_url && (
                    <div className="relative">
                      <Image
                        src={instance.cover_image_url}
                        alt={`Cover`}
                        width={400}
                        height={300}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handleDownload(instance.id, 'cover')}
                        className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
                        title="Download Cover"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Elements Preview (removed in no-batch design) */}

                  {/* Download Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(instance.id, 'cover')}
                      disabled={!instance.cover_image_url}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ImageIcon className="w-4 h-4" />
                      Cover
                    </button>
                    
                    <button
                      onClick={() => handleDownload(instance.id, 'video')}
                      disabled={!instance.video_url}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                        instance.downloaded 
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Play className="w-4 h-4" />
                      {instance.downloaded ? 'Downloaded' : `Video (${instance.credits_cost})`}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-8">
            <button
              onClick={() => resetWorkflow()}
              className="flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              Create Another
            </button>

            <button
              onClick={() => router.push('/dashboard/videos')}
              className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium cursor-pointer"
            >
              <History className="w-4 h-4" />
              View All Results
            </button>
          </div>
        </div>
      );
    }

    // Failed state
    if (state.workflowStatus === 'failed') {
      return (
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl text-red-600">✗</span>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Oops! Something went wrong
            </h3>
            <p className="text-gray-600 text-base">
              We encountered an issue while processing your request.
            </p>
          </div>
          
          <button
            onClick={() => resetWorkflow()}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium"
          >
            Try Again
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {!isLoaded ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
      <>
      <Sidebar 
        credits={userCredits} 
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="ml-64 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-gray-700" />
                </div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Create Multiple Ad Variations
                </h1>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {state.error && (
            kieCreditsStatus.loading ? null : (
              state.error.includes('maintenance') || !kieCreditsStatus.sufficient ? (
                <MaintenanceMessage />
              ) : (
                <div className="mb-8 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
                  <strong>Error:</strong> {state.error}
                </div>
              )
            )
          )}

          {/* Main Content */}
          <div className="relative bg-white border border-gray-200 rounded-lg p-8 overflow-hidden">
            {renderWorkflowContent()}

            {/* Silky animated overlay while generating (from Generate click until next screen) */}
            <AnimatePresence>
              {state.workflowStatus === 'uploaded' && state.isLoading && (
                <motion.div
                  key="overlay"
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Animated message stack */}
                  <motion.div
                    key={overlayIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4 }}
                    aria-live="polite"
                    className="text-center"
                  >
                    <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-0">
                      {overlayMessages[overlayIndex % overlayMessages.length]}
                    </p>
                  </motion.div>

                  {/* Neutral animated dots to indicate activity without implying linear progress */}
                  <div className="mt-6 flex items-center gap-2" aria-hidden="true">
                    {[0,1,2].map((i) => (
                      <motion.span
                        key={i}
                        className="block w-2 h-2 rounded-full bg-gray-900"
                        initial={{ opacity: 0.3, scale: 1 }}
                        animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.1, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
