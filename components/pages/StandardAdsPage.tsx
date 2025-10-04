'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useStandardAdsWorkflow } from '@/hooks/useStandardAdsWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import InsufficientCredits from '@/components/InsufficientCredits';
import { ArrowRight, History, Play, TrendingUp, Hash, Type, ChevronDown, Package } from 'lucide-react';
import GenerationConfirmation from '@/components/ui/GenerationConfirmation';
import VideoModelSelector from '@/components/ui/VideoModelSelector';
import VideoAspectRatioSelector from '@/components/ui/VideoAspectRatioSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import SizeSelector from '@/components/ui/SizeSelector';
import ProductSelector, { TemporaryProduct } from '@/components/ProductSelector';
import ProductManager from '@/components/ProductManager';
import ShowcaseSection from '@/components/ui/ShowcaseSection';
import { useRouter } from 'next/navigation';
import { canAffordModel, CREDIT_COSTS } from '@/lib/constants';
import { AnimatePresence, motion } from 'framer-motion';
import { UserProduct } from '@/lib/supabase';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

export default function StandardAdsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, updateCredits, refetchCredits } = useCredits();
  const [selectedModel, setSelectedModel] = useState<'auto' | 'veo3' | 'veo3_fast' | 'sora2'>('auto');
  const [selectedImageModel, setSelectedImageModel] = useState<'auto' | 'nano_banana' | 'seedream'>('auto');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true
  });
  const [textWatermark, setTextWatermark] = useState('');
  const [textWatermarkLocation, setTextWatermarkLocation] = useState('bottom left');
  const [elementsCount, setElementsCount] = useState(1);
  const [imageSize, setImageSize] = useState('auto');
  const [shouldGenerateVideo, setShouldGenerateVideo] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | TemporaryProduct | null>(null);
  const [showProductManager, setShowProductManager] = useState(false);
  
  
  const handleModelChange = (model: 'auto' | 'veo3' | 'veo3_fast' | 'sora2') => {
    setSelectedModel(model);
  };

  const handleImageModelChange = (model: 'auto' | 'nano_banana' | 'seedream') => {
    setSelectedImageModel(model);
  };
  const router = useRouter();
  
  const {
    state,
    startWorkflowWithConfig,
    startWorkflowWithSelectedProduct,
    startWorkflowWithTemporaryImages,
    resetWorkflow
  } = useStandardAdsWorkflow(
    user?.id,
    // Standard workflow does not support Sora2; coerce to supported model
    (selectedModel === 'sora2' ? 'veo3' : selectedModel) as 'auto' | 'veo3' | 'veo3_fast',
    selectedImageModel,
    updateCredits,
    refetchCredits,
    elementsCount,
    imageSize
  );


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


  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }


  const isTemporaryProduct = (product: UserProduct | TemporaryProduct | null): product is TemporaryProduct => {
    return product !== null && 'isTemporary' in product && product.isTemporary === true;
  };

  const handleStartWorkflow = async () => {
    const watermarkConfig = {
      enabled: textWatermark.trim().length > 0,
      text: textWatermark.trim(),
      location: textWatermarkLocation
    };

    // Handle temporary product (direct upload)
    if (selectedProduct && isTemporaryProduct(selectedProduct)) {
      await startWorkflowWithTemporaryImages(
        selectedProduct.uploadedFiles,
        watermarkConfig,
        elementsCount,
        imageSize,
        shouldGenerateVideo
      );
    } else if (selectedProduct) {
      // Use selected product for workflow
      await startWorkflowWithSelectedProduct(selectedProduct.id, watermarkConfig, elementsCount, imageSize, shouldGenerateVideo);
    } else {
      await startWorkflowWithConfig(watermarkConfig, elementsCount, imageSize, shouldGenerateVideo);
    }
  };

  const handleResetWorkflow = () => {
    resetWorkflow();
    setSelectedProduct(null);
    setShowProductManager(false);
  };

  const features = [
    {
      title: 'Authentic Product Focus',
      description: 'Maintains product integrity while creating compelling video narratives'
    },
    {
      title: 'Performance Optimized',
      description: 'AI-crafted pacing, captions, and motion designed for conversion'
    },
    {
      title: 'Professional Quality',
      description: 'Studio-grade results without the studio-grade budget'
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
    
    // Show main interface when no workflow is running
    if (state.workflowStatus === 'started') {
      // Product Manager interface
      if (showProductManager) {
        return (
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <button
                onClick={() => setShowProductManager(false)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                ← Back to Professional Video Ads
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
                  Professional Video Ads
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  Create conversion-ready video advertisements that maintain product authenticity while leveraging AI-powered storytelling and motion design.
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

              {/* Product Selection */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Select Product</h3>
                </div>
                <ProductSelector
                  selectedProduct={selectedProduct}
                  onProductSelect={setSelectedProduct}
                  onManageProducts={() => setShowProductManager(true)}
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

                {/* Product Preview - Show when product is selected */}
                {selectedProduct && (
                  <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    {selectedProduct.user_product_photos?.find(p => p.is_primary) && (
                      <Image
                        src={selectedProduct.user_product_photos.find(p => p.is_primary)?.photo_url || selectedProduct.user_product_photos[0]?.photo_url || ''}
                        alt="Selected product"
                        width={60}
                        height={60}
                        className="rounded-lg object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{selectedProduct.product_name}</p>
                      <p className="text-sm text-gray-600">Selected product</p>
                    </div>
                  </div>
                )}

                {/* Configuration Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Elements Count */}
                  <div>
                    <label className="flex items-center gap-2 text-base font-medium text-gray-900 mb-3">
                      <Hash className="w-4 h-4" />
                      Ads
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

                {/* Watermark Configuration */}
                <div>
                  <label className="flex items-center gap-2 text-base font-medium text-gray-900 mb-3">
                    <Type className="w-4 h-4" />
                    Watermark
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Optional</span>
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={textWatermark}
                      onChange={(e) => setTextWatermark(e.target.value)}
                      placeholder="Enter brand name or watermark text..."
                      maxLength={50}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                    />
                    <select
                      value={textWatermarkLocation}
                      onChange={(e) => setTextWatermarkLocation(e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                    >
                      <option value="bottom left">Bottom Left</option>
                      <option value="bottom right">Bottom Right</option>
                      <option value="top left">Top Left</option>
                      <option value="top right">Top Right</option>
                      <option value="center bottom">Center Bottom</option>
                    </select>
                  </div>
                </div>

                {/* Size Configuration */}
                <SizeSelector
                  selectedSize={imageSize}
                  onSizeChange={setImageSize}
                  showIcon={true}
                />

                {/* Model Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ImageModelSelector
                    credits={userCredits || 0}
                    selectedModel={selectedImageModel}
                    onModelChange={handleImageModelChange}
                    showIcon={true}
                  />
                  {shouldGenerateVideo && (
                    <VideoModelSelector
                      credits={userCredits || 0}
                      selectedModel={selectedModel}
                      onModelChange={handleModelChange}
                      showIcon={true}
                      hideCredits={true}
                    />
                  )}
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleStartWorkflow}
                  disabled={state.isLoading || !selectedProduct}
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
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Free</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Showcase Section - Notion style design */}
          <div className="border border-gray-100/80 bg-white/60 backdrop-blur-sm rounded-xl p-6 mt-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-6 h-6 bg-gray-900 rounded-md flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-xl font-medium text-gray-900 tracking-tight">
                  See how entrepreneurs create viral ads with AI
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Real examples from our community
                </p>
              </div>
            </div>
            <ShowcaseSection
              workflowType="standard-ads"
              className="max-w-5xl mx-auto"
            />
          </div>
        </div>
      );
    }

    // Show configuration interface after upload
    if (state.workflowStatus === 'uploaded_waiting_config') {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 h-full">
            {/* Left Side - Image Preview emphasised */}
            <div className="lg:col-span-6 flex flex-col h-full">
              {/* Show uploaded file image */}
              {state.data.uploadedFile?.url && (
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white shadow-lg p-2 sm:p-3 flex relative overflow-hidden flex-1">
                  {/* Subtle background pattern */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{
                      backgroundImage: `radial-gradient(circle at 25% 25%, #6366f1 2px, transparent 2px), radial-gradient(circle at 75% 75%, #8b5cf6 2px, transparent 2px)`,
                      backgroundSize: '50px 50px'
                    }}></div>
                  </div>
                  <div className="flex-1 relative z-10 overflow-hidden flex flex-col">
                    <div className="relative w-full flex-1 flex items-center justify-center">
                      <Image
                        src={state.data.uploadedFile.url}
                        alt="Product"
                        width={640}
                        height={640}
                        className="w-full h-auto object-contain rounded-xl bg-white/80 backdrop-blur-sm shadow-xl border border-white/20 max-h-[360px]"
                      />
                      {/* Subtle glow effect */}
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-transparent to-white/10 pointer-events-none"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Configuration Area */}
            <div className="lg:col-span-6 space-y-4 flex flex-col">

              {/* Elements Count Selector - segmented control */}
              <div>
                <label className="flex items-center gap-2 text-base font-medium text-gray-900 mb-2">
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
                        className={`relative px-5 py-2 text-base font-semibold rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
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
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-base font-medium text-gray-900">
                  <Type className="w-4 h-4" />
                  Watermark
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                    Optional
                  </span>
                </label>

                {/* Watermark Text Input and Location Selector */}
                <div className="flex gap-2">
                  {/* Left: Text Input - increased proportion */}
                  <div className="flex-[2]">
                    <input
                      id="watermark-text"
                      type="text"
                      value={textWatermark}
                      onChange={(e) => setTextWatermark(e.target.value)}
                      placeholder="Enter brand name or watermark text..."
                      maxLength={50}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm shadow-sm"
                    />
                  </div>

                  {/* Right: Location Selector - increased width */}
                  <div className="relative w-40">
                    <select
                      id="watermark-location"
                      value={textWatermarkLocation}
                      onChange={(e) => setTextWatermarkLocation(e.target.value)}
                      className="w-full px-3 py-1.5 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white text-sm shadow-sm appearance-none cursor-pointer"
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
            <SizeSelector
              selectedSize={imageSize}
              onSizeChange={setImageSize}
              showIcon={true}
            />

              {/* Video Generation Option - moved after Ads */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-base font-medium text-gray-900">
                  <Play className="w-4 h-4" />
                  Video
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShouldGenerateVideo(true)}
                    className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                      shouldGenerateVideo ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-pressed={shouldGenerateVideo}
                  >
                    Generate video
                  </button>
                  <button
                    type="button"
                    onClick={() => setShouldGenerateVideo(false)}
                    className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                      !shouldGenerateVideo ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-pressed={!shouldGenerateVideo}
                  >
                    Images only
                  </button>
                </div>
              </div>

              {/* Model Selection - in one row */}
              <div className="grid grid-cols-2 gap-4">
                {/* Image Model Selection */}
                <ImageModelSelector
                  credits={userCredits || 0}
                  selectedModel={selectedImageModel}
                  onModelChange={handleImageModelChange}
                  showIcon={true}
                  className="col-span-1"
                />

                {/* Video Model Selection - only show when video generation is enabled */}
                {shouldGenerateVideo && (
                  <VideoModelSelector
                    credits={userCredits || 0}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    showIcon={true}
                    hideCredits={true}
                    className="col-span-1"
                  />
                )}

                {/* Placeholder when video is disabled */}
                {!shouldGenerateVideo && (
                  <div className="col-span-1 space-y-2">
                    <label className="flex items-center gap-2 text-base font-medium text-gray-400">
                      <Play className="w-4 h-4" />
                      Video Model
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">
                      Video generation disabled
                    </div>
                  </div>
                )}

                {/* Video Aspect Ratio Selection - only show when video generation is enabled */}
                {shouldGenerateVideo && (
                  <VideoAspectRatioSelector
                    selectedAspectRatio={videoAspectRatio}
                    onAspectRatioChange={setVideoAspectRatio}
                    showIcon={true}
                    className="col-span-1"
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 mt-auto">
                <button
                  onClick={handleStartWorkflow}
                  disabled={state.isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-2.5 rounded-lg hover:bg-gray-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium relative overflow-hidden group"
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

              </div>
            </div>

            
          </div>
        </div>
      );
    }

    // Show workflow initiated success state
    if (state.workflowStatus === 'workflow_initiated') {
      return (
        <GenerationConfirmation
          title="Your content is being generated!"
          description="The generation process is now running in the background."
          estimatedTime="Usually takes 3-5 minutes"
          onCreateAnother={handleResetWorkflow}
        />
      );
    }

    // For processing workflow, only show failed state
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
              We encountered an issue: {state.error || state.data.errorMessage || 'Unknown error occurred'}
            </p>
          </div>

          <div className="pt-4">
            <button
              onClick={handleResetWorkflow}
              className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    // Hide in_progress state - users don't need to wait on page

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
                <TrendingUp className="w-4 h-4" />
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
              onClick={handleResetWorkflow}
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

      <div className="ml-72 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Create Professional Video Ads
              </h1>
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
                className="relative bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 lg:p-7 shadow-sm overflow-hidden"
              >
                {workflowContent}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
