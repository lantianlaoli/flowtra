'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useMultiVariantAdsWorkflow } from '@/hooks/useMultiVariantAdsWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { useToast } from '@/contexts/ToastContext';
import Sidebar from '@/components/layout/Sidebar';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import { ArrowRight, Play, Hash, Layers, TrendingUp, AlertCircle, HelpCircle, Coins } from 'lucide-react';
import VideoModelSelector from '@/components/ui/VideoModelSelector';
import VideoQualitySelector from '@/components/ui/VideoQualitySelector';
import VideoDurationSelector from '@/components/ui/VideoDurationSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import VideoAspectRatioSelector from '@/components/ui/VideoAspectRatioSelector';
import SizeSelector from '@/components/ui/SizeSelector';
import LanguageSelector, { LanguageCode } from '@/components/ui/LanguageSelector';
import BrandProductSelector from '@/components/ui/BrandProductSelector';
import ProductManager from '@/components/ProductManager';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  getActualModel,
  getActualImageModel,
  isFreeGenerationModel,
  getGenerationCost,
  modelSupports,
  getAvailableDurations,
  getAvailableQualities,
  type VideoModel,
  type VideoDuration
} from '@/lib/constants';
import { UserProduct, UserBrand } from '@/lib/supabase';

const ALL_VIDEO_QUALITIES: Array<'standard' | 'high'> = ['standard', 'high'];
type LegacyDuration = '8' | '10' | '15';
const ALL_VIDEO_DURATIONS: Array<LegacyDuration> = ['8', '10', '15'];
const isClassicDuration = (duration: VideoDuration): duration is LegacyDuration =>
  duration === '8' || duration === '10' || duration === '15';
const ALL_VIDEO_MODELS: VideoModel[] = ['veo3', 'veo3_fast', 'sora2', 'sora2_pro'];

export default function MultiVariantAdsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();
  const { showSuccess } = useToast();
  // NEW: Top-level video config state
  const [videoQuality, setVideoQuality] = useState<'standard' | 'high'>('standard');
  const [videoDuration, setVideoDuration] = useState<LegacyDuration>('10');
  const [selectedModel, setSelectedModel] = useState<'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' | 'auto'>('veo3_fast');
  const [selectedImageModel, setSelectedImageModel] = useState<'nano_banana' | 'seedream'>('seedream');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [elementsCount, setElementsCount] = useState(2);
  const [imageSize, setImageSize] = useState('auto');
  const [shouldGenerateVideo, setShouldGenerateVideo] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<UserBrand | null>(null);
  const [showProductManager, setShowProductManager] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const router = useRouter();
  const [kieCreditsStatus, setKieCreditsStatus] = useState<{ sufficient: boolean; loading: boolean; currentCredits?: number; threshold?: number }>({
    sufficient: true,
    loading: true
  });

  
  // Get the actual models to use for the workflow
  const actualModel = getActualModel(selectedModel, userCredits || 0) || 'veo3_fast';
  // Multi-variant workflow now supports Sora2
  const actualModelForWorkflow: 'veo3' | 'veo3_fast' | 'sora2' = actualModel as 'veo3' | 'veo3_fast' | 'sora2';
  const computedImageModel = getActualImageModel(selectedImageModel);
  const actualImageModel: 'nano_banana' | 'seedream' = computedImageModel === 'nano_banana_pro'
    ? 'nano_banana'
    : computedImageModel;

  // Auto-derive ad copy and watermark from brand
  const derivedAdCopy = selectedBrand?.brand_slogan || '';
  const derivedWatermark = selectedBrand?.brand_name || '';
  const textWatermarkLocation = 'bottom left';

  const {
    state,
    startBatchWorkflow,
    startBatchWorkflowWithProduct,
    resetWorkflow
  } = useMultiVariantAdsWorkflow(
    user?.id,
    actualModelForWorkflow,
    actualImageModel,
    elementsCount,
    derivedAdCopy,
    derivedWatermark,
    textWatermarkLocation,
    imageSize,
    shouldGenerateVideo,
    videoAspectRatio,
    selectedModel
  );

  // Calculate available and disabled options based on current selection
  const availableDurations = useMemo<Array<LegacyDuration>>(
    () => getAvailableDurations(videoQuality, ALL_VIDEO_MODELS).filter(isClassicDuration) as Array<LegacyDuration>,
    [videoQuality]
  );

  const availableQualities = useMemo(
    () => getAvailableQualities(videoDuration),
    [videoDuration]
  );

  const disabledDurations = useMemo(
    () => ALL_VIDEO_DURATIONS.filter(d => !availableDurations.includes(d)),
    [availableDurations]
  );

  const disabledQualities = useMemo(
    () => ALL_VIDEO_QUALITIES.filter(q => !availableQualities.includes(q)),
    [availableQualities]
  );

  const disabledModels = useMemo(
    () => ALL_VIDEO_MODELS.filter(m => !modelSupports(m, videoQuality, videoDuration)),
    [videoQuality, videoDuration]
  );

  // Handle quality change with auto-adjustment of duration if needed
  const handleVideoQualityChange = useCallback(
    (quality: 'standard' | 'high') => {
      const supportedDurations = getAvailableDurations(quality, ALL_VIDEO_MODELS).filter(isClassicDuration) as Array<LegacyDuration>;

      if (!supportedDurations.includes(videoDuration)) {
        const nextDuration = supportedDurations[0] ?? '10';
        setVideoDuration(nextDuration);
      }

      setVideoQuality(quality);
    },
    [videoDuration]
  );

  // Handle duration change with auto-adjustment of quality if needed
  const handleVideoDurationChange = useCallback(
    (duration: VideoDuration) => {
      const normalizedDuration: LegacyDuration = isClassicDuration(duration) ? duration : '8';
      const supportedQualities = getAvailableQualities(normalizedDuration);

      if (!supportedQualities.includes(videoQuality)) {
        const nextQuality = supportedQualities[0] ?? 'standard';
        setVideoQuality(nextQuality);
      }

      setVideoDuration(normalizedDuration);
    },
    [videoQuality]
  );

  // Handle model change with validation
  const handleModelChange = useCallback(
    (model: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro') => {
      // Filter out 'auto' since our state doesn't support it
      if (model !== 'auto' && modelSupports(model, videoQuality, videoDuration)) {
        setSelectedModel(model);
      }
    },
    [videoQuality, videoDuration]
  );

  const handleImageModelChange = (model: 'auto' | 'nano_banana' | 'seedream') => {
    if (model === 'auto') return;
    setSelectedImageModel(model);
  };

  // Note: keep hooks above; render loading UI later to avoid conditional hooks

  const handleStartWorkflow = async () => {
    try {
      // Show toast notification immediately
      showSuccess(
        'Added to generation queue! Your ad is being created in the background.',
        5000,
        { label: 'View Progress →', href: '/dashboard/videos' }
      );

      if (selectedProduct) {
        // Use product workflow with selected product
        await startBatchWorkflowWithProduct(selectedProduct.id);
      } else {
        await startBatchWorkflow();
      }
    } catch (error) {
      console.error('Failed to start workflow:', error);
    }
  };

  const handleResetWorkflow = () => {
    resetWorkflow();
    setSelectedProduct(null);
    setSelectedBrand(null);
    setShowProductManager(false);
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

  const features = [
    {
      title: 'Creative Variations',
      description: 'Generate multiple distinct creative approaches from a single product'
    },
    {
      title: 'A/B Testing Ready',
      description: 'Compare hooks, styles, and motion concepts to find winning combinations'
    },
    {
      title: 'Scale Optimized',
      description: 'Test creative directions before committing to larger ad spend'
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
    // Show main interface when idle or processing
    if (state.workflowStatus === 'idle' || state.workflowStatus === 'processing') {
      // Product Manager interface
      if (showProductManager) {
        return (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <button
                onClick={() => setShowProductManager(false)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Multiple Ad Variations
              </button>
            </div>
            <ProductManager />
          </div>
        );
      }

      return (
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 items-start">
            {/* Left Column - Description, Features, and Product Selection */}
            <div className="lg:col-span-5 space-y-6">
              {/* Feature Introduction */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Multiple Ad Variations
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Generate multiple creative variations from a single product to test different hooks, styles, and approaches for optimal campaign performance.
                </p>
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{feature.title}</h4>
                        <p className="text-xs text-gray-600">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand & Product Selection */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
                <BrandProductSelector
                  selectedBrand={selectedBrand}
                  selectedProduct={selectedProduct}
                  onBrandSelect={setSelectedBrand}
                  onProductSelect={setSelectedProduct}
                />
              </div>
            </div>

            {/* Right Column - Configuration */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>
                </div>

                {/* Configuration Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Elements Count */}
                  <div>
                    <label className="flex items-center gap-2 text-base font-medium text-gray-900 mb-3">
                      <Hash className="w-4 h-4" />
                      Variations
                    </label>
                    <div className="relative inline-flex rounded-xl border border-gray-300 bg-white p-1 shadow-sm">
                      {[1,2,3].map((val) => {
                        const active = elementsCount === val;
                        return (
                          <button
                            key={val}
                            onClick={() => setElementsCount(val)}
                            className={`relative px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                              active ? 'bg-gray-900 text-white' : 'text-gray-800 hover:bg-gray-50'
                            } ${val !== 1 ? 'ml-1' : ''}`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Video Generation Toggle */}
                  <div>
                    <label className="flex items-center gap-2 text-base font-medium text-gray-900 mb-3">
                      <Play className="w-4 h-4" />
                      Generate Video
                    </label>
                    <button
                      onClick={() => setShouldGenerateVideo(!shouldGenerateVideo)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
                        shouldGenerateVideo ? 'bg-gray-900' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          shouldGenerateVideo ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Video Quality and Duration */}
                {shouldGenerateVideo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <VideoQualitySelector
                      selectedQuality={videoQuality}
                      onQualityChange={handleVideoQualityChange}
                      showIcon={true}
                      disabledQualities={disabledQualities}
                    />
                    <VideoDurationSelector
                      selectedDuration={videoDuration}
                      onDurationChange={handleVideoDurationChange}
                      showIcon={true}
                      disabledDurations={disabledDurations}
                    />
                  </div>
                )}

                {/* Model Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ImageModelSelector
                    credits={userCredits || 0}
                    selectedModel={selectedImageModel}
                    onModelChange={handleImageModelChange}
                    showIcon={true}
                    hiddenModels={['auto']}
                  />
                  {shouldGenerateVideo && (
                    <>
                      <VideoModelSelector
                        credits={userCredits || 0}
                        selectedModel={selectedModel}
                        onModelChange={(model) => {
                          if (model === 'grok') return;
                          handleModelChange(model);
                        }}
                        videoQuality={videoQuality}
                        videoDuration={videoDuration}
                        showIcon={true}
                        hiddenModels={['auto', 'grok']}
                        disabledModels={disabledModels as Array<'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro'>}
                        adsCount={elementsCount}
                      />
                    </>
                  )}
                </div>

                {/* Size and Aspect Ratio */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SizeSelector
                    selectedSize={imageSize}
                    onSizeChange={setImageSize}
                    imageModel={selectedImageModel}
                    videoAspectRatio={videoAspectRatio}
                    showIcon={true}
                  />
                  {shouldGenerateVideo && (
                    <VideoAspectRatioSelector
                      selectedAspectRatio={videoAspectRatio}
                      onAspectRatioChange={setVideoAspectRatio}
                      showIcon={true}
                    />
                  )}
                </div>

                {/* Language Selection */}
                <LanguageSelector
                  selectedLanguage={selectedLanguage}
                  onLanguageChange={setSelectedLanguage}
                  showIcon={true}
                />

                {/* Generate Button */}
                <button
                  onClick={handleStartWorkflow}
                  disabled={state.isLoading || !selectedProduct || !selectedBrand}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {state.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Generating…</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5" />
                      <span>Generate</span>
                      {(() => {
                        // Calculate credits for button display
                        const actualModel = getActualModel(selectedModel, userCredits || 0);
                        if (!actualModel) return null;

                        const isFreeGen = isFreeGenerationModel(actualModel);
                        if (isFreeGen) {
                          // Free generation models - show FREE badge
                          return (
                            <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded">
                              FREE
                            </span>
                          );
                        } else {
                          // Paid generation models - show credit cost (× variants count)
                          const cost = getGenerationCost(actualModel, videoDuration, videoQuality) * elementsCount;
                          return (
                            <span className="ml-2 px-2.5 py-1 bg-gray-800 text-white text-sm font-medium rounded flex items-center gap-1.5">
                              <Coins className="w-4 h-4" />
                              <span>{cost}</span>
                            </span>
                          );
                        }
                      })()}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show configuration interface after upload
    if (state.workflowStatus === 'uploaded') {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12">
            {/* Left Side - Image Preview emphasised */}
            <div className="lg:col-span-7">
              {/* Show uploaded file image */}
              {state.uploadedFile?.url && (
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-lg p-3 sm:p-5 flex min-h-[360px] relative overflow-hidden">
                  {/* Subtle background pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{
                      backgroundImage: `radial-gradient(circle at 25% 25%, #6366f1 2px, transparent 2px), radial-gradient(circle at 75% 75%, #8b5cf6 2px, transparent 2px)`,
                      backgroundSize: '50px 50px'
                    }}></div>
                  </div>
                  <div className="flex-1 flex items-center justify-center relative z-10">
                    <div className="relative">
                      <Image
                        src={state.uploadedFile.url}
                        alt="Product"
                        width={640}
                        height={640}
                        className="w-full h-auto object-contain rounded-xl bg-white/80 backdrop-blur-sm shadow-xl border border-white/20"
                      />
                      {/* Subtle glow effect */}
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-transparent to-white/10 pointer-events-none"></div>
                    </div>
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

              {/* Video Quality and Duration */}
              {shouldGenerateVideo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <VideoQualitySelector
                    selectedQuality={videoQuality}
                    onQualityChange={handleVideoQualityChange}
                    showIcon={true}
                    disabledQualities={disabledQualities}
                  />
                  <VideoDurationSelector
                    selectedDuration={videoDuration}
                    onDurationChange={handleVideoDurationChange}
                    showIcon={true}
                    disabledDurations={disabledDurations}
                  />
                </div>
              )}

              {/* Model Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImageModelSelector
                  credits={userCredits || 0}
                  selectedModel={selectedImageModel}
                  onModelChange={handleImageModelChange}
                  showIcon={true}
                  className="col-span-1"
                  hiddenModels={['auto']}
                />
                {shouldGenerateVideo && (
                  <>
                    <VideoModelSelector
                      credits={userCredits || 0}
                      selectedModel={selectedModel}
                      onModelChange={(model) => {
                        if (model === 'grok') return;
                        handleModelChange(model);
                      }}
                      videoQuality={videoQuality}
                      videoDuration={videoDuration}
                      showIcon={true}
                      className="col-span-1"
                      hiddenModels={['auto', 'grok']}
                      disabledModels={disabledModels as Array<'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro'>}
                      adsCount={elementsCount}
                    />
                  </>
                )}
                {!shouldGenerateVideo && (
                  <div className="col-span-1 space-y-3">
                    <label className="flex items-center gap-2 text-base font-medium text-gray-400">
                      <Play className="w-4 h-4" />
                      Video Model
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                      Video generation disabled
                    </div>
                  </div>
                )}
              </div>

              {/* Image Size and Aspect Ratio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SizeSelector
                  selectedSize={imageSize}
                  onSizeChange={setImageSize}
                  imageModel={selectedImageModel}
                  videoAspectRatio={videoAspectRatio}
                  showIcon={true}
                />
                {shouldGenerateVideo && (
                  <VideoAspectRatioSelector
                    selectedAspectRatio={videoAspectRatio}
                    onAspectRatioChange={setVideoAspectRatio}
                    showIcon={true}
                  />
                )}
              </div>

              {/* Language Selection */}
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                showIcon={true}
              />

              {/* Video Generation Option - moved after Ads */}
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

              {/* Action Buttons moved to right side */}
              <div className="space-y-3">
                <button
                  onClick={handleStartWorkflow}
                  disabled={state.isLoading || !selectedProduct || !selectedBrand}
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
                      {(() => {
                        // Calculate credits for button display
                        const actualModel = getActualModel(selectedModel, userCredits || 0);
                        if (!actualModel) return null;

                        const isFreeGen = isFreeGenerationModel(actualModel);
                        if (isFreeGen) {
                          // Free generation models - show FREE badge
                          return (
                            <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded">
                              FREE
                            </span>
                          );
                        } else {
                          // Paid generation models - show credit cost (× variants count)
                          const cost = getGenerationCost(actualModel, videoDuration, videoQuality) * elementsCount;
                          return (
                            <span className="ml-2 px-2.5 py-1 bg-gray-800 text-white text-sm font-medium rounded flex items-center gap-1.5">
                              <Coins className="w-4 h-4" />
                              <span>{cost}</span>
                            </span>
                          );
                        }
                      })()}
                    </>
                  )}
                </button>

              </div>
            </div>
          </div>
        </div>
      );
    }

    // processing state is now handled by toast notification - no UI needed
    // completed state is also handled by navigation to /dashboard/videos

    // Failed state
    if (state.workflowStatus === 'failed') {
      return (
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">
              Oops! Something went wrong
            </h3>
            <p className="text-gray-600 text-base">
              We encountered an issue while processing your request.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleResetWorkflow}
              className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/dashboard/support')}
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium flex items-center justify-center gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              Having Trouble?
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const workflowContent = renderWorkflowContent();

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
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen pt-14 md:pt-0">
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Layers className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Create Multiple Ad Variations
              </h1>
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
          <AnimatePresence mode="wait">
            {workflowContent && (
              <motion.div
                key={state.workflowStatus === 'processing' ? 'idle' : state.workflowStatus}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.24, ease: [0.22, 0.61, 0.36, 1] }}
                className="relative bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 lg:p-7 shadow-sm overflow-visible"
              >
                {workflowContent}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
