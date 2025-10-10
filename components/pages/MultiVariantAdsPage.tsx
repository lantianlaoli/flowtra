'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useMultiVariantAdsWorkflow } from '@/hooks/useMultiVariantAdsWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import { ArrowRight, History, Play, Image as ImageIcon, Hash, Type, ChevronDown, Layers, Package, TrendingUp, Sparkles, Wand2 } from 'lucide-react';
import GenerationConfirmation from '@/components/ui/GenerationConfirmation';
import VideoModelSelector from '@/components/ui/VideoModelSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import VideoAspectRatioSelector from '@/components/ui/VideoAspectRatioSelector';
import SizeSelector from '@/components/ui/SizeSelector';
import ProductSelector, { TemporaryProduct } from '@/components/ProductSelector';
import ProductManager from '@/components/ProductManager';
import ShowcaseSection from '@/components/ui/ShowcaseSection';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { getActualModel, getActualImageModel } from '@/lib/constants';
import { UserProduct } from '@/lib/supabase';

export default function MultiVariantAdsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, refetchCredits } = useCredits();
  const [selectedModel, setSelectedModel] = useState<'veo3' | 'veo3_fast' | 'sora2'>('veo3_fast');
  const [selectedImageModel, setSelectedImageModel] = useState<'nano_banana' | 'seedream'>('seedream');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [elementsCount, setElementsCount] = useState(2);
  const [adCopy, setAdCopy] = useState('');
  const [isGeneratingAdCopy, setIsGeneratingAdCopy] = useState(false);
  const [adCopyError, setAdCopyError] = useState<string | null>(null);
  const [hasAIGeneratedAdCopy, setHasAIGeneratedAdCopy] = useState(false);
  const [textWatermark, setTextWatermark] = useState('');
  const [textWatermarkLocation, setTextWatermarkLocation] = useState('bottom left');
  const [isSuggestingWatermark, setIsSuggestingWatermark] = useState(false);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);
  const [hasAISuggestedWatermark, setHasAISuggestedWatermark] = useState(false);
  const [imageSize, setImageSize] = useState('auto');
  const [shouldGenerateVideo, setShouldGenerateVideo] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | TemporaryProduct | null>(null);
  const [showProductManager, setShowProductManager] = useState(false);
  const router = useRouter();
  const [kieCreditsStatus, setKieCreditsStatus] = useState<{ sufficient: boolean; loading: boolean; currentCredits?: number; threshold?: number }>({
    sufficient: true,
    loading: true
  });

  
  // Get the actual models to use for the workflow
  const actualModel = getActualModel(selectedModel, userCredits || 0) || 'veo3_fast';
  // Multi-variant workflow does not support Sora2; coerce to supported model
  const actualModelForWorkflow: 'veo3' | 'veo3_fast' = (actualModel === 'sora2' ? 'veo3' : actualModel) as 'veo3' | 'veo3_fast';
  const actualImageModel = getActualImageModel(selectedImageModel);

  const ALLOWED_WATERMARK_LOCATIONS = ['bottom left', 'bottom right', 'top left', 'top right', 'center bottom'] as const;

  const {
    state,
    startBatchWorkflow,
    startBatchWorkflowWithProduct,
    startBatchWorkflowWithTemporaryImages,
    downloadContent,
    resetWorkflow
  } = useMultiVariantAdsWorkflow(
    user?.id,
    actualModelForWorkflow,
    actualImageModel,
    elementsCount,
    adCopy,
    textWatermark,
    textWatermarkLocation,
    imageSize,
    shouldGenerateVideo,
    videoAspectRatio,
    selectedModel
  );

  const handleModelChange = (model: 'auto' | 'veo3' | 'veo3_fast' | 'sora2') => {
    if (model === 'auto') return;
    setSelectedModel(model);
  };

  const handleImageModelChange = (model: 'auto' | 'nano_banana' | 'seedream') => {
    if (model === 'auto') return;
    setSelectedImageModel(model);
  };

  // Note: keep hooks above; render loading UI later to avoid conditional hooks


  const isTemporaryProduct = (product: UserProduct | TemporaryProduct | null): product is TemporaryProduct => {
    return product !== null && 'isTemporary' in product && product.isTemporary === true;
  };

  const handleStartWorkflow = async () => {
    try {
      // Handle temporary product (direct upload)
      if (selectedProduct && isTemporaryProduct(selectedProduct)) {
        await startBatchWorkflowWithTemporaryImages(selectedProduct.uploadedFiles);
      } else if (selectedProduct) {
        // Use product workflow if product is selected
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
    setShowProductManager(false);
    setHasAIGeneratedAdCopy(false);
    setAdCopyError(null);
    setHasAISuggestedWatermark(false);
    setWatermarkError(null);
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

  const collectContext = useCallback(() => {
    const productName =
      selectedProduct && 'product_name' in selectedProduct ? selectedProduct.product_name : undefined;
    const productDescription =
      selectedProduct && 'description' in selectedProduct ? selectedProduct.description : undefined;

    const productPhotos =
      selectedProduct && 'user_product_photos' in selectedProduct
        ? (selectedProduct.user_product_photos || [])
            .map((photo) => photo?.photo_url)
            .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url))
        : [];

    const uploadedUrl =
      state.uploadedFile?.url && /^https?:\/\//i.test(state.uploadedFile.url)
        ? state.uploadedFile.url
        : undefined;

    const allImageUrls = [...productPhotos, uploadedUrl]
      .filter((url): url is string => Boolean(url))
      .filter((value, index, self) => self.indexOf(value) === index)
      .slice(0, 3);

    if (!productName && !productDescription && allImageUrls.length === 0) {
      return null;
    }

    return {
      productName,
      productDescription,
      productImageUrls: allImageUrls
    };
  }, [selectedProduct, state.uploadedFile]);

  const canUseAIHelpers = useMemo(() => collectContext() !== null, [collectContext]);

  const handleAdCopyChange = (value: string) => {
    setAdCopy(value);
    setAdCopyError(null);
    if (value.trim().length === 0) {
      setHasAIGeneratedAdCopy(false);
    }
  };

  const handleGenerateAdCopy = async () => {
    if (isGeneratingAdCopy) return;
    const context = collectContext();
    if (!context) {
      setAdCopyError('Select a product or upload an image first.');
      return;
    }

    setIsGeneratingAdCopy(true);
    setAdCopyError(null);

    try {
      const response = await fetch('/api/multi-variant-ads/ad-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to generate ad copy.');
      }

      setAdCopy(result.adCopy || '');
      setHasAIGeneratedAdCopy(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate ad copy.';
      setAdCopyError(message);
      setHasAIGeneratedAdCopy(false);
    } finally {
      setIsGeneratingAdCopy(false);
    }
  };

  const normaliseLocation = (location: string | undefined) => {
    if (!location) return 'bottom left';
    const lower = location.toLowerCase().trim();
    const match = ALLOWED_WATERMARK_LOCATIONS.find((loc) => loc === lower);
    return match || 'bottom left';
  };

  const handleWatermarkTextChange = (value: string) => {
    setTextWatermark(value);
    setWatermarkError(null);
    if (value.trim().length === 0) {
      setHasAISuggestedWatermark(false);
    }
  };

  const handleWatermarkLocationChange = (value: string) => {
    setTextWatermarkLocation(normaliseLocation(value));
    setWatermarkError(null);
  };

  const handleSuggestWatermark = async () => {
    if (isSuggestingWatermark) return;
    const context = collectContext();
    if (!context) {
      setWatermarkError('Select a product or upload an image first.');
      return;
    }

    setIsSuggestingWatermark(true);
    setWatermarkError(null);

    try {
      const response = await fetch('/api/multi-variant-ads/watermark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context)
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to suggest watermark.');
      }

      setTextWatermark(result.text || '');
      setTextWatermarkLocation(normaliseLocation(result.location));
      setHasAISuggestedWatermark(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to suggest watermark.';
      setWatermarkError(message);
      setHasAISuggestedWatermark(false);
    } finally {
      setIsSuggestingWatermark(false);
    }
  };


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
    // Show main interface when idle
    if (state.workflowStatus === 'idle') {
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

              {/* Product Selection */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Select Product</h3>
                </div>
                <ProductSelector
                  selectedProduct={selectedProduct}
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

                {/* Product Preview - Show when product is selected */}
                {selectedProduct && !isTemporaryProduct(selectedProduct) && (
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
                    <VideoModelSelector
                      credits={userCredits || 0}
                      selectedModel={selectedModel}
                      onModelChange={handleModelChange}
                      showIcon={true}
                      hiddenModels={['auto']}
                    />
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

                {/* Ad Copy Configuration */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <label className="flex items-center gap-2 text-base font-medium text-gray-900">
                      <Type className="w-4 h-4" />
                      Ad Copy
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Optional</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAdCopy}
                      disabled={isGeneratingAdCopy || !canUseAIHelpers}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
                    >
                      {isGeneratingAdCopy ? (
                        <>
                          <span className="h-3 w-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                          Generating…
                        </>
                      ) : hasAIGeneratedAdCopy ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          Regenerate
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          AI Generate
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={adCopy}
                    onChange={(e) => handleAdCopyChange(e.target.value)}
                    placeholder="Enter ad copy (optional)..."
                    maxLength={120}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                  />
                  {adCopyError ? (
                    <p className="text-xs text-red-500 mt-1">{adCopyError}</p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      If provided, all variations will use this ad copy.
                    </p>
                  )}
                </div>

                {/* Watermark Configuration */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <label className="flex items-center gap-2 text-base font-medium text-gray-900">
                      <Type className="w-4 h-4" />
                      Watermark
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">Optional</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSuggestWatermark}
                      disabled={isSuggestingWatermark || !canUseAIHelpers}
                      className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-60"
                    >
                      {isSuggestingWatermark ? (
                        <>
                          <span className="h-3 w-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                          Analyzing…
                        </>
                      ) : hasAISuggestedWatermark ? (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          Regenerate
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-3.5 h-3.5" />
                          AI Suggest
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={textWatermark}
                      onChange={(e) => handleWatermarkTextChange(e.target.value)}
                      placeholder="Enter brand name or watermark text..."
                      maxLength={50}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                    />
                    <select
                      value={textWatermarkLocation}
                      onChange={(e) => handleWatermarkLocationChange(e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                    >
                      <option value="bottom left">Bottom Left</option>
                      <option value="bottom right">Bottom Right</option>
                      <option value="top left">Top Left</option>
                      <option value="top right">Top Right</option>
                      <option value="center bottom">Center Bottom</option>
                    </select>
                  </div>
                  {watermarkError && <p className="text-xs text-red-500 mt-1">{watermarkError}</p>}
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
              workflowType="multi-variant-ads"
              className="max-w-5xl mx-auto"
            />
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
                  <VideoModelSelector
                    credits={userCredits || 0}
                    selectedModel={selectedModel}
                    onModelChange={handleModelChange}
                    showIcon={true}
                    className="col-span-1"
                    hiddenModels={['auto']}
                  />
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

              {/* Ad Copy Configuration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-base font-medium text-gray-900">
                    <Type className="w-4 h-4" />
                    Ad Copy
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAdCopy}
                    disabled={isGeneratingAdCopy || !canUseAIHelpers}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
                  >
                    {isGeneratingAdCopy ? (
                      <>
                        <span className="h-3 w-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                        Generating…
                      </>
                    ) : hasAIGeneratedAdCopy ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Regenerate
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Generate
                      </>
                    )}
                  </button>
                </div>
                <input
                  id="ad-copy-text"
                  type="text"
                  value={adCopy}
                  onChange={(e) => handleAdCopyChange(e.target.value)}
                  placeholder="Enter ad copy (optional)..."
                  maxLength={120}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm shadow-sm"
                />
                {adCopyError ? (
                  <p className="text-xs text-red-500">{adCopyError}</p>
                ) : (
                  <p className="text-xs text-gray-500">If provided, all variations will use this ad copy.</p>
                )}
              </div>

              {/* Watermark Configuration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-base font-medium text-gray-900">
                    <Type className="w-4 h-4" />
                    Watermark
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                      Optional
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSuggestWatermark}
                    disabled={isSuggestingWatermark || !canUseAIHelpers}
                    className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-60"
                  >
                    {isSuggestingWatermark ? (
                      <>
                        <span className="h-3 w-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                        Analyzing…
                      </>
                    ) : hasAISuggestedWatermark ? (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        Regenerate
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" />
                        AI Suggest
                      </>
                    )}
                  </button>
                </div>

                {/* Watermark Text Input and Location Selector - Left Right Layout */}
                <div className="flex gap-3">
                  {/* Left: Text Input - increased proportion */}
                  <div className="flex-[2]">
                    <input
                      id="watermark-text"
                      type="text"
                      value={textWatermark}
                      onChange={(e) => handleWatermarkTextChange(e.target.value)}
                      placeholder="Enter brand name or watermark text..."
                      maxLength={50}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm shadow-sm"
                    />
                  </div>

                  {/* Right: Location Selector - increased width */}
                  <div className="relative w-40">
                    <select
                      id="watermark-location"
                      value={textWatermarkLocation}
                      onChange={(e) => handleWatermarkLocationChange(e.target.value)}
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
                {watermarkError && <p className="text-xs text-red-500">{watermarkError}</p>}
              </div>

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

              </div>
            </div>
          </div>
        </div>
      );
    }

    // Show simple started state (Notion style) instead of progress page
    if (state.workflowStatus === 'processing') {
      return (
        <GenerationConfirmation
          title="Your ad variations are being generated!"
          description="Multiple creative approaches are being created in the background."
          estimatedTime="Usually takes 3-5 minutes"
          onCreateAnother={handleResetWorkflow}
        />
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
                    {instance.elements_data?.generate_video !== false ? (
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
                    ) : (
                      <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                        <Play className="w-4 h-4" />
                        Video skipped
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-8">
            <button
              onClick={handleResetWorkflow}
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
            onClick={handleResetWorkflow}
            className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium"
          >
            Try Again
          </button>
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
      </>
      )}
    </div>
  );
}
