'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStandardAdsWorkflow } from '@/hooks/useStandardAdsWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { useToast } from '@/contexts/ToastContext';
import Sidebar from '@/components/layout/Sidebar';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import InsufficientCredits from '@/components/InsufficientCredits';
import { ArrowRight, Play, TrendingUp, Hash, Type, Package, Sparkles, Wand2 } from 'lucide-react';
import VideoConfigurationSelector, { VideoConfiguration } from '@/components/ui/VideoConfigurationSelector';
import VideoAspectRatioSelector from '@/components/ui/VideoAspectRatioSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import SizeSelector from '@/components/ui/SizeSelector';
import LanguageSelector, { LanguageCode } from '@/components/ui/LanguageSelector';
import ProductSelector, { TemporaryProduct } from '@/components/ProductSelector';
import ProductManager from '@/components/ProductManager';

import {
  canAffordModel,
  CREDIT_COSTS,
  isFreeGenerationModel,
  getGenerationCost,
  getActualModel,
  getDefaultVideoConfiguration
} from '@/lib/constants';
import { AnimatePresence, motion } from 'framer-motion';
import { UserProduct, UserBrand } from '@/lib/supabase';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

export default function StandardAdsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, updateCredits, refetchCredits } = useCredits();
  const { showSuccess, showError } = useToast();

  // Video configuration (unified model + quality + duration)
  const [videoConfig, setVideoConfig] = useState<VideoConfiguration>(() => getDefaultVideoConfiguration());
  const [selectedImageModel, setSelectedImageModel] = useState<'nano_banana' | 'seedream'>('nano_banana');
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
  const [selectedBrand, setSelectedBrand] = useState<UserBrand | null>(null);
  const [showProductManager, setShowProductManager] = useState(false);
  const [adCopy, setAdCopy] = useState('');
  const [isGeneratingAdCopy, setIsGeneratingAdCopy] = useState(false);
  const [adCopyError, setAdCopyError] = useState<string | null>(null);
  const [hasAIGeneratedAdCopy, setHasAIGeneratedAdCopy] = useState(false);
  const [isSuggestingWatermark, setIsSuggestingWatermark] = useState(false);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);
  const [hasAISuggestedWatermark, setHasAISuggestedWatermark] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [useCustomScript, setUseCustomScript] = useState(false);
  const [customScript, setCustomScript] = useState('');
  const [activeTab, setActiveTab] = useState<'adcopy' | 'script'>('adcopy');
  const [hasUserQueuedToast, setHasUserQueuedToast] = useState(false);


  const handleImageModelChange = (model: 'auto' | 'nano_banana' | 'seedream') => {
    // Filter out 'auto' since our state doesn't support it
    if (model !== 'auto') {
      setSelectedImageModel(model);
    }
  };

  
  
  const {
    state,
    startWorkflowWithConfig,
    startWorkflowWithSelectedProduct,
    startWorkflowWithTemporaryImages,
    resetWorkflow
  } = useStandardAdsWorkflow(
    user?.id,
    videoConfig.model,
    selectedImageModel,
    updateCredits,
    refetchCredits,
    elementsCount,
    imageSize,
    videoAspectRatio,
    videoConfig.quality,
    videoConfig.duration,
    adCopy,
    selectedLanguage,
    useCustomScript,
    customScript
  );

  const ALLOWED_WATERMARK_LOCATIONS = ['bottom left', 'bottom right', 'top left', 'top right', 'center bottom'] as const;
  const uploadedImageUrl = state.data.uploadedFile?.url;

  

  const collectContext = useCallback(() => {
    const productName = selectedProduct && 'product_name' in selectedProduct ? selectedProduct.product_name : undefined;
    const productDescription = selectedProduct && 'description' in selectedProduct ? selectedProduct.description : undefined;

    const productPhotos = selectedProduct && 'user_product_photos' in selectedProduct
      ? (selectedProduct.user_product_photos || [])
          .map((photo) => photo?.photo_url)
          .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url))
      : [];

    const uploadedUrl = uploadedImageUrl && /^https?:\/\//i.test(uploadedImageUrl)
      ? uploadedImageUrl
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
  }, [selectedProduct, uploadedImageUrl]);

  const canUseAIHelpers = useMemo(() => collectContext() !== null, [collectContext]);

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
      const response = await fetch('/api/standard-ads/ad-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...context, language: selectedLanguage })
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
      const response = await fetch('/api/standard-ads/watermark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...context, language: selectedLanguage })
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

  const handleAdCopyChange = (value: string) => {
    setAdCopy(value);
    if (hasAIGeneratedAdCopy) {
      setHasAIGeneratedAdCopy(false);
    }
  };

  const handleWatermarkTextChange = (value: string) => {
    setTextWatermark(value);
    if (hasAISuggestedWatermark) {
      setHasAISuggestedWatermark(false);
    }
  };

  const handleWatermarkLocationChange = (value: string) => {
    setTextWatermarkLocation(normaliseLocation(value));
    if (hasAISuggestedWatermark) {
      setHasAISuggestedWatermark(false);
    }
  };


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

  const handleResetWorkflow = useCallback(() => {
    resetWorkflow();
    setSelectedProduct(null);
    setSelectedBrand(null);
    setShowProductManager(false);
    setAdCopy('');
    setHasAIGeneratedAdCopy(false);
    setAdCopyError(null);
    setTextWatermark('');
    setTextWatermarkLocation('bottom left');
    setHasAISuggestedWatermark(false);
    setWatermarkError(null);
    setUseCustomScript(false);
    setCustomScript('');
    setActiveTab('adcopy');
  }, [resetWorkflow]);

  // Show toast notification when workflow is initiated, then reset page
  useEffect(() => {
    // Only show toast if counter is greater than 0 (workflow has been initiated at least once)
    if (state.workflowInitiatedCount > 0) {
      if (!hasUserQueuedToast) {
        showSuccess(
          'Added to generation queue! Your ad is being created in the background.',
          5000,
          { label: 'View Progress →', href: '/dashboard/videos' }
        );
      } else {
        setHasUserQueuedToast(false);
      }

      // Reset the page to allow creating another ad immediately
      // Small delay to ensure toast is shown before reset
      setTimeout(() => {
        handleResetWorkflow();
      }, 100);
    }
  }, [state.workflowInitiatedCount, showSuccess, handleResetWorkflow, hasUserQueuedToast]);

  useEffect(() => {
    if (state.error) {
      showError(state.error.includes('Failed') ? state.error : `Failed to start workflow: ${state.error}`);
      if (hasUserQueuedToast) {
        setHasUserQueuedToast(false);
      }
    }
  }, [state.error, hasUserQueuedToast, showError]);


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
    showSuccess(
      'Added to generation queue! Your ad is being created in the background.',
      5000,
      { label: 'View Progress →', href: '/dashboard/videos' }
    );
    setHasUserQueuedToast(true);

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
        shouldGenerateVideo,
        selectedBrand?.id
      );
    } else if (selectedProduct) {
      // Use selected product for workflow
      await startWorkflowWithSelectedProduct(
        selectedProduct.id,
        watermarkConfig,
        elementsCount,
        imageSize,
        shouldGenerateVideo,
        selectedBrand?.id
      );
    } else {
      await startWorkflowWithConfig(
        watermarkConfig,
        elementsCount,
        imageSize,
        shouldGenerateVideo,
        selectedBrand?.id
      );
    }
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
    
    // Always show main interface (workflow runs in background)
    if (true) {
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
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Top Banner - Feature Introduction */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Professional Video Ads
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Create conversion-ready video advertisements that maintain product authenticity while leveraging AI-powered storytelling and motion design.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          {/* Main Grid - Left: Configuration, Right: Product & Content */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            {/* Left Column - Basic Configuration (7/12 = ~60%) */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Basic Configuration</h3>
                </div>

                {/* Ads Count and Generate Video Toggle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                {/* Image Model and Video Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ImageModelSelector
                    credits={userCredits || 0}
                    selectedModel={selectedImageModel}
                    onModelChange={handleImageModelChange}
                    showIcon={true}
                    hiddenModels={['auto']}
                  />
                  {shouldGenerateVideo && (
                    <VideoConfigurationSelector
                      credits={userCredits || 0}
                      selectedConfig={videoConfig}
                      onConfigChange={setVideoConfig}
                      showIcon={true}
                      adsCount={elementsCount}
                    />
                  )}
                </div>

                {/* Size and Video Aspect Ratio */}
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
              </div>
            </div>

            {/* Right Column - Product Selection & Content (5/12 = ~40%) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Product Selection */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Product Selection</h3>
                </div>
                <ProductSelector
                  selectedProduct={selectedProduct}
                  onProductSelect={setSelectedProduct}
                  selectedBrand={selectedBrand}
                  onBrandSelect={setSelectedBrand}
                  videoModel={videoConfig.model}
                  shouldGenerateVideo={shouldGenerateVideo}
                />
              </div>

              {/* Tab Section - Ad Copy/Watermark OR Custom Script */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Type className="w-5 h-5 text-gray-700" />
                  <h3 className="text-lg font-semibold text-gray-900">Custom Script or Ad Copy & Watermark</h3>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 mb-4 border-b border-gray-200">
                  <button
                    onClick={() => {
                      setActiveTab('adcopy');
                      setUseCustomScript(false);
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                      activeTab === 'adcopy'
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Ad Copy & Watermark
                  </button>
                  {shouldGenerateVideo && (
                    <button
                      onClick={() => {
                        setActiveTab('script');
                        setUseCustomScript(true);
                        setAdCopy('');
                        setTextWatermark('');
                      }}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === 'script'
                          ? 'border-purple-600 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        Custom Script
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Advanced</span>
                      </span>
                    </button>
                  )}
                </div>

                {/* Tab Content */}
                <div className="space-y-4">
                  {activeTab === 'adcopy' ? (
                    <>
                      {/* Ad Copy */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-900">
                            Ad Copy
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">Optional</span>
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
                        {adCopyError && <p className="text-xs text-red-500 mt-1">{adCopyError}</p>}
                      </div>

                      {/* Watermark */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium text-gray-900">
                            Watermark
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full ml-2">Optional</span>
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
                        <div className="flex gap-2 flex-col sm:flex-row">
                          <input
                            type="text"
                            value={textWatermark}
                            onChange={(e) => handleWatermarkTextChange(e.target.value)}
                            placeholder="Enter brand name or watermark text..."
                            maxLength={50}
                            className="w-full sm:flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
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
                    </>
                  ) : (
                    /* Custom Script Tab */
                    <div className="space-y-3">
                      <textarea
                        value={customScript}
                        onChange={(e) => setCustomScript(e.target.value)}
                        placeholder="Paste your pre-generated video script here..."
                        rows={15}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 text-sm font-mono bg-white"
                      />
                      {customScript.trim().length > 0 && (
                        <p className="text-xs text-gray-600">
                          Script length: {customScript.trim().length} characters
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Full-width Generate Button at Bottom */}
          <button
            onClick={handleStartWorkflow}
            disabled={state.isLoading || !selectedProduct}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
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
                  const actualModel = getActualModel(videoConfig.model, userCredits || 0);
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
                    // Paid generation models - show credit cost
                    const cost = getGenerationCost(actualModel, videoConfig.duration, videoConfig.quality) * elementsCount;
                    return (
                      <span className="ml-2 text-sm opacity-90">
                        (-{cost} credits)
                      </span>
                    );
                  }
                })()}
              </>
            )}
          </button>
        </div>
      );
    }

    // No additional UI states needed - workflow runs completely in background
    return null;
  };

  // Removed legacy states: uploaded_waiting_config, failed, completed
  // All workflow processing happens in background via monitor-tasks

  const workflowContent = renderWorkflowContent();

  return (
    <div className="min-h-screen bg-gray-50">
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
