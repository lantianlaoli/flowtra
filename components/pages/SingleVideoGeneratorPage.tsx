'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSingleVideoWorkflow } from '@/hooks/useSingleVideoWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import FileUpload from '@/components/FileUpload';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import InsufficientCredits from '@/components/InsufficientCredits';
import { RotateCcw, ArrowRight, History, Play, Sparkles, Hash, Type, Square, ChevronDown } from 'lucide-react';
import VideoModelSelector from '@/components/ui/VideoModelSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import { useRouter } from 'next/navigation';
import { canAffordModel, CREDIT_COSTS } from '@/lib/constants';
import { AnimatePresence, motion } from 'framer-motion';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

export default function SingleVideoGeneratorPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, updateCredits, refetchCredits } = useCredits();
  const [selectedModel, setSelectedModel] = useState<'auto' | 'veo3' | 'veo3_fast'>('auto');
  const [selectedImageModel, setSelectedImageModel] = useState<'auto' | 'nano_banana' | 'seedream'>('auto');
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true
  });
  const [textWatermark, setTextWatermark] = useState('');
  const [textWatermarkLocation, setTextWatermarkLocation] = useState('bottom left');
  const [elementsCount, setElementsCount] = useState(1);
  const [imageSize, setImageSize] = useState('auto');
  const [shouldGenerateVideo, setShouldGenerateVideo] = useState(true);
  
  
  const handleModelChange = (model: 'auto' | 'veo3' | 'veo3_fast') => {
    setSelectedModel(model);
  };

  const handleImageModelChange = (model: 'auto' | 'nano_banana' | 'seedream') => {
    setSelectedImageModel(model);
  };
  const router = useRouter();
  
  const {
    state,
    uploadFile,
    startWorkflowWithConfig,
    resetWorkflow
  } = useSingleVideoWorkflow(user?.id, selectedModel, selectedImageModel, updateCredits, refetchCredits, elementsCount, imageSize);

  // Silky overlay messages (parity with V2)
  const overlayMessages = [
    'Sketching cover compositions…',
    'Exploring multiple creative directions…',
    'Choosing lenses, framing, and timing…',
    'Designing camera moves and transitions…',
    'Polishing color and lighting — almost there…'
  ];
  const [overlayIndex, setOverlayIndex] = useState(0);
  useEffect(() => {
    const showOverlay = state.workflowStatus === 'uploaded_waiting_config' && state.isLoading;
    if (!showOverlay) return;
    setOverlayIndex(0);
    const interval = setInterval(() => {
      setOverlayIndex((idx) => (idx + 1) % overlayMessages.length);
    }, 2600);
    return () => clearInterval(interval);
  }, [state.workflowStatus, state.isLoading, overlayMessages.length]);

  // Check KIE credits on page load
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
        setKieCreditsStatus({
          sufficient: false,
          loading: false
        });
      }
    };

    checkKieCredits();
  }, []);

  const getHumanizedStepMessage = (step: string | null) => {
    if (step === 'describing') {
      return `Getting to know your product...`;
    }
    if (step === 'generating_prompts') {
      return `Crafting your ad concept...`;
    }
    if (step === 'generating_cover') {
      return `Designing your visuals...`;
    }
    if (step === 'generating_video') {
      return `Bringing it all together...`;
    }
    return `Processing...`;
  };

  const getStepDisplayName = (step: string | null) => {
    if (step === 'describing') {
      return 'Understanding Product';
    }
    if (step === 'generating_prompts') {
      return 'Creating Concept';
    }
    if (step === 'generating_cover') {
      return 'Designing Visuals';
    }
    if (step === 'generating_video') {
      return 'Finalizing Ad';
    }
    return 'Processing';
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const handleFileUpload = async (files: File | File[]) => {
    // Handle both single file and multiple files
    const fileArray = Array.isArray(files) ? files : [files];
    
    // For now, process the first file (extend later for batch processing)
    if (fileArray.length > 0) {
      await uploadFile(fileArray[0]);
    }
  };

  const handleStartWorkflow = async () => {
    const watermarkConfig = {
      enabled: textWatermark.trim().length > 0,
      text: textWatermark.trim(),
      location: textWatermarkLocation
    };

    await startWorkflowWithConfig(watermarkConfig, elementsCount, imageSize, shouldGenerateVideo);
  };

  const v1Highlights = [
    {
      label: 'Ideal for',
      description: 'Product shots that must stay true to the original photography without stylistic changes.'
    },
    {
      label: 'What you get',
      description: 'One polished, conversion-ready video ad centered on the exact product photo you upload.'
    },
    {
      label: 'Best used when',
      description: 'You need 1:1 authenticity for PDP updates, catalog ads, or performance remarketing refreshes.'
    }
  ];

  

  const renderWorkflowContent = () => {
    // Check KIE credits first - if insufficient, show maintenance interface
    if (!kieCreditsStatus.loading && !kieCreditsStatus.sufficient) {
      return (
        <div className="max-w-xl mx-auto">
          <MaintenanceMessage />
        </div>
      );
    }
    
    // Check user credits - if insufficient for any model, show recharge guidance
    if (userCredits !== undefined && !canAffordModel(userCredits, 'auto')) {
      return <InsufficientCredits currentCredits={userCredits} requiredCredits={CREDIT_COSTS.veo3_fast} />;
    }
    
    // Show upload interface when no workflow is running
    if (state.workflowStatus === 'started') {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900 mb-2.5">
                  When this workflow shines
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Reach for Professional Video Ads when you need faithful, product-driven storytelling. Flowtra keeps your product true-to-shot while crafting pacing, captions, and motion tuned for performance spend.
                </p>
              </div>
              <div className="grid gap-4">
                {v1Highlights.map((item) => (
                  <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                      {item.label}
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3 sm:p-5">
                <FileUpload onFileUpload={handleFileUpload} isLoading={state.isLoading} multiple={false} variant="compact" />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show configuration interface after upload
    if (state.workflowStatus === 'uploaded_waiting_config') {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
            {/* Left Side - Image Preview emphasised */}
            <div className="lg:col-span-7">
              {state.data.uploadedFile?.url && (
                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3 sm:p-5 flex min-h-[360px]">
                  <div className="flex-1 flex items-center justify-center">
                    <Image
                      src={state.data.uploadedFile.url}
                      alt="Product"
                      width={640}
                      height={640}
                      className="w-full h-auto object-contain rounded-xl bg-gray-100"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Configuration Area */}
            <div className="lg:col-span-5 space-y-5">

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

                {/* Watermark Text Input and Location Selector */}
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

                  {/* Right: Location Selector */}
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

              {/* Image Model Selection */}
              <ImageModelSelector
                credits={userCredits || 0}
                selectedModel={selectedImageModel}
                onModelChange={handleImageModelChange}
              />

              {/* Video Model Selection */}
              {shouldGenerateVideo && (
                <VideoModelSelector
                  credits={userCredits || 0}
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                />
              )}

              {/* Video Generation Option (match V2 layout) */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-base font-medium text-gray-900">
                  <Play className="w-4 h-4" />
                  Video
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShouldGenerateVideo(true)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                      shouldGenerateVideo ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-pressed={shouldGenerateVideo}
                  >
                    Generate video
                  </button>
                  <button
                    type="button"
                    onClick={() => setShouldGenerateVideo(false)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                      !shouldGenerateVideo ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-pressed={!shouldGenerateVideo}
                  >
                    Images only
                  </button>
                </div>

                <p className="text-sm text-gray-500">
                  Skip video to finalize the workflow once all images are generated.
                </p>
              </div>

              {/* Action Buttons */}
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

    // Show workflow initiated success state
    if (state.workflowStatus === 'workflow_initiated') {
      return (
        <div className="max-w-2xl mx-auto text-center space-y-6">
          {/* Success indicator */}
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          {/* Content */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium text-gray-900">
              Ad Creation Started
            </h3>
            <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
              Your ad is being created. The process is now running in the background.
            </p>
          </div>
          
          {/* Action buttons */}
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

    // For processing workflow, show progress page
    if (state.workflowStatus === 'in_progress' || state.workflowStatus === 'failed') {
      return (
        <div className="max-w-xl mx-auto text-center space-y-6 animate-bounce-in">
          <div className="relative">
            {state.workflowStatus === 'failed' ? (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto animate-pulse-glow">
                <span className="text-2xl text-red-600">✗</span>
              </div>
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto animate-float">
                <div className="relative">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-r-white rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 animate-slide-in-left">
              {state.workflowStatus === 'failed' ? 'Oops! Something went wrong' : 'Creating your masterpiece...'}
            </h3>
            <p className="text-gray-600 text-base animate-slide-in-right">
              {state.workflowStatus === 'failed' 
                ? `We encountered an issue: ${state.error || state.data.errorMessage || 'Unknown error occurred'}`
                : getHumanizedStepMessage(state.currentStep)
              }
            </p>
            {state.workflowStatus === 'in_progress' && (
              <div className="space-y-3 animate-slide-in-left">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-700 ease-out relative overflow-hidden" 
                    style={{ width: `${state.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span className="font-medium">{getStepDisplayName(state.currentStep)}</span>
                  <span className="font-bold text-blue-600">{state.progress}%</span>
                </div>
              </div>
            )}
          </div>
          
          {state.workflowStatus === 'failed' && (
            <div className="pt-4 animate-slide-in-right">
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      );
    }

    // For completed workflow, show success page
    if (state.workflowStatus === 'completed') {
      return (
        <div className="max-w-xl mx-auto text-center space-y-6 animate-bounce-in">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto animate-float">
              <div className="relative">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {/* Success ring animation */}
                <div className="absolute inset-0 w-8 h-8 border-4 border-white/30 rounded-full animate-pulse-glow"></div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-gray-900 animate-slide-in-left">
              All done!
            </h3>
            <p className="text-gray-600 text-lg animate-slide-in-right">
              Your ad is ready to make some noise!
            </p>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 animate-slide-in-left">
              <div className="flex items-center gap-2 text-green-700">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">Ready to download and share!</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-in-right">
            <button
              onClick={() => router.push('/dashboard/videos')}
              className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-3 rounded-lg hover:from-gray-800 hover:to-gray-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-1 cursor-pointer"
            >
              <History className="w-4 h-4" />
              View Results
            </button>
            <button
              onClick={() => resetWorkflow()}
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              Create Another
            </button>
          </div>
        </div>
      );
    }

    // Hide all processing steps from user
    return null;
  };

  const workflowContent = renderWorkflowContent();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={userCredits}
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
                  Create Professional Video Ads
                </h1>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {state.error && (
            <div className="mb-8">
              {state.error.includes('maintenance') ? (
                <MaintenanceMessage />
              ) : (
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
                  <strong>Error:</strong> {state.error}
                </div>
              )}
            </div>
          )}

          {/* Main Content */}
          <AnimatePresence mode="wait">
            {workflowContent && (
              <motion.div
                key={state.workflowStatus}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
                className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 lg:p-7 shadow-sm relative overflow-hidden"
              >
                {workflowContent}

                {/* Silky animated overlay while generating (from Generate click until next screen) */}
                <AnimatePresence>
                  {state.workflowStatus === 'uploaded_waiting_config' && state.isLoading && (
                    <motion.div
                      key="overlay"
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
