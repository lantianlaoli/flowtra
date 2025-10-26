'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStandardAdsWorkflow } from '@/hooks/useStandardAdsWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { useToast } from '@/contexts/ToastContext';
import Sidebar from '@/components/layout/Sidebar';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import InsufficientCredits from '@/components/InsufficientCredits';
import { ArrowRight, TrendingUp } from 'lucide-react';

// New components for redesigned UX
import OutputModeToggle, { type OutputMode } from '@/components/ui/OutputModeToggle';
import GenerationModeToggle, { type GenerationMode } from '@/components/ui/GenerationModeToggle';
import BrandProductCard from '@/components/ui/BrandProductCard';
import CustomPromptInput from '@/components/ui/CustomPromptInput';
import FormatSelector, { type Format, type ImageFormat, type VideoFormat } from '@/components/ui/FormatSelector';

// Existing components
import VideoModelSelector from '@/components/ui/VideoModelSelector';
import VideoQualitySelector from '@/components/ui/VideoQualitySelector';
import VideoDurationSelector from '@/components/ui/VideoDurationSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import LanguageSelector, { LanguageCode } from '@/components/ui/LanguageSelector';
import ProductSelector from '@/components/ProductSelector';
import ProductManager from '@/components/ProductManager';

import {
  canAffordModel,
  CREDIT_COSTS,
  modelSupports,
  getAvailableDurations,
  getAvailableQualities,
  type VideoModel
} from '@/lib/constants';
import { AnimatePresence, motion } from 'framer-motion';
import { UserProduct, UserBrand } from '@/lib/supabase';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

const ALL_VIDEO_QUALITIES: Array<'standard' | 'high'> = ['standard', 'high'];
const ALL_VIDEO_DURATIONS: Array<'8' | '10' | '15'> = ['8', '10', '15'];
const ALL_VIDEO_MODELS: VideoModel[] = ['veo3', 'veo3_fast', 'sora2', 'sora2_pro'];

export default function StandardAdsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, updateCredits, refetchCredits } = useCredits();
  const { showSuccess, showError } = useToast();

  // NEW: Core mode states
  const [outputMode, setOutputMode] = useState<OutputMode>('video');
  const [generationMode, setGenerationMode] = useState<GenerationMode>('auto');
  const [format, setFormat] = useState<Format>('16:9'); // Default video format
  const [customPrompt, setCustomPrompt] = useState('');

  // Video configuration states (only used when outputMode = 'video')
  const [videoQuality, setVideoQuality] = useState<'standard' | 'high'>('standard');
  const [videoDuration, setVideoDuration] = useState<'8' | '10' | '15'>('8');
  const [selectedModel, setSelectedModel] = useState<VideoModel>('veo3_fast');

  // Image configuration states (always used for cover image)
  const [selectedImageModel, setSelectedImageModel] = useState<'nano_banana' | 'seedream'>('nano_banana');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');

  // Other states
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true
  });
  // Fixed to 1 - removed multi-ad generation
  const elementsCount = 1;
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<UserBrand | null>(null);
  const [showProductManager, setShowProductManager] = useState(false);
  const [hasUserQueuedToast, setHasUserQueuedToast] = useState(false);

  const handleImageModelChange = (model: 'auto' | 'nano_banana' | 'seedream') => {
    if (model !== 'auto') {
      setSelectedImageModel(model);
    }
  };

  // Auto-derive adCopy and watermark from brand
  const derivedAdCopy = selectedBrand?.brand_slogan || '';
  const derivedWatermark = selectedBrand?.brand_name || '';

  // Combine custom prompt with brand info for custom mode
  const buildFinalPrompt = useCallback(() => {
    if (generationMode === 'auto') {
      // Auto mode: use brand slogan
      return derivedAdCopy;
    } else {
      // Custom mode: combine user prompt with brand info
      const brandInfo = selectedBrand
        ? `Brand: ${selectedBrand.brand_name}. ${selectedBrand.brand_slogan}.`
        : '';
      const productInfo = selectedProduct
        ? `Product: ${selectedProduct.product_name || 'Product'}.`
        : '';

      return `${customPrompt}\n\n${brandInfo} ${productInfo}`.trim();
    }
  }, [generationMode, customPrompt, derivedAdCopy, selectedBrand, selectedProduct]);

  const {
    state,
    startWorkflowWithConfig,
    startWorkflowWithSelectedProduct,
    resetWorkflow
  } = useStandardAdsWorkflow(
    user?.id,
    selectedModel,
    selectedImageModel,
    updateCredits,
    refetchCredits,
    elementsCount,
    format, // Pass format instead of imageSize
    format as '16:9' | '9:16', // videoAspectRatio (temporary, will be cleaned in workflow)
    videoQuality,
    videoDuration,
    buildFinalPrompt(), // Use derived/combined prompt
    selectedLanguage,
    generationMode === 'custom', // useCustomScript flag
    generationMode === 'custom' ? buildFinalPrompt() : '' // customScript
  );

  // Handle output mode change
  const handleOutputModeChange = useCallback((mode: OutputMode) => {
    setOutputMode(mode);

    // Auto-switch format to appropriate default
    if (mode === 'image') {
      setFormat('1:1'); // Default image format
    } else {
      setFormat('16:9'); // Default video format
    }
  }, []);

  // Calculate available and disabled options based on current selection (for video mode)
  const availableDurations = useMemo(
    () => getAvailableDurations(videoQuality),
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
      const supportedDurations = getAvailableDurations(quality);

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
    (duration: '8' | '10' | '15') => {
      const supportedQualities = getAvailableQualities(duration);

      if (!supportedQualities.includes(videoQuality)) {
        const nextQuality = supportedQualities[0] ?? 'standard';
        setVideoQuality(nextQuality);
      }

      setVideoDuration(duration);
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

  // Check KIE API credits
  useEffect(() => {
    const checkKieCredits = async () => {
      try {
        const response = await fetch('/api/check-kie-credits');
        const data = await response.json();

        setKieCreditsStatus({
          sufficient: data.sufficient,
          loading: false,
          currentCredits: data.currentCredits,
          threshold: data.threshold
        });
      } catch (error) {
        console.error('Failed to check KIE credits:', error);
        setKieCreditsStatus({
          sufficient: true,
          loading: false
        });
      }
    };

    checkKieCredits();
  }, []);

  const handleStartWorkflow = async () => {
    showSuccess(
      'Added to generation queue! Your ad is being created in the background.',
      5000,
      { label: 'View Progress →', href: '/dashboard/videos' }
    );
    setHasUserQueuedToast(true);

    const watermarkConfig = {
      enabled: derivedWatermark.trim().length > 0,
      text: derivedWatermark.trim(),
      location: 'bottom left' as const
    };

    if (selectedProduct) {
      await startWorkflowWithSelectedProduct(
        selectedProduct.id,
        watermarkConfig,
        elementsCount,
        format,
        outputMode === 'video', // shouldGenerateVideo
        selectedBrand?.id
      );
    } else {
      await startWorkflowWithConfig(
        watermarkConfig,
        elementsCount,
        format,
        outputMode === 'video', // shouldGenerateVideo
        selectedBrand?.id
      );
    }
  };

  const features = [
    {
      title: 'Brand-Driven Creation',
      description: 'All ads are built around your brand identity and product catalog'
    },
    {
      title: 'Flexible Modes',
      description: 'Auto mode for quick generation, Custom mode for precise control'
    },
    {
      title: 'Professional Quality',
      description: 'Studio-grade results for both image and video advertisements'
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

    // Product Manager interface
    if (showProductManager) {
      return (
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => setShowProductManager(false)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← Back to Professional Ads
            </button>
          </div>
          <ProductManager />
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Banner - Feature Introduction */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Professional Brand Ads
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Create brand-driven advertisements with AI-powered automation. Choose between auto generation or custom mode for precise control.
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

        {/* Main Configuration */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gray-700" />
            <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>
          </div>

          {/* NEW: Mode Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <OutputModeToggle
              mode={outputMode}
              onModeChange={handleOutputModeChange}
            />
            <GenerationModeToggle
              mode={generationMode}
              onModeChange={setGenerationMode}
            />
          </div>

          {/* NEW: Brand & Product Card with integrated selector */}
          <div className="space-y-4">
            <BrandProductCard
              brand={selectedBrand}
              product={selectedProduct}
            />
            <ProductSelector
              selectedProduct={selectedProduct}
              onProductSelect={(product) => {
                setSelectedProduct(product);
                // Extract brand from product if available
                if (product && 'brand' in product && product.brand) {
                  setSelectedBrand(product.brand as UserBrand);
                }
              }}
            />
          </div>

          {/* Single Row: Language, Duration, Quality, Format (for video mode) */}
          {outputMode === 'video' ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                showIcon={true}
              />
              <VideoDurationSelector
                selectedDuration={videoDuration}
                onDurationChange={handleVideoDurationChange}
                showIcon={true}
                disabledDurations={disabledDurations}
              />
              <VideoQualitySelector
                selectedQuality={videoQuality}
                onQualityChange={handleVideoQualityChange}
                showIcon={true}
                disabledQualities={disabledQualities}
              />
              <FormatSelector
                outputMode={outputMode}
                selectedFormat={format}
                onFormatChange={setFormat}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <LanguageSelector
                selectedLanguage={selectedLanguage}
                onLanguageChange={setSelectedLanguage}
                showIcon={true}
              />
              <ImageModelSelector
                credits={userCredits || 0}
                selectedModel={selectedImageModel}
                onModelChange={handleImageModelChange}
                showIcon={true}
                hiddenModels={['auto']}
              />
              <FormatSelector
                outputMode={outputMode}
                selectedFormat={format}
                onFormatChange={setFormat}
              />
            </div>
          )}

          {/* Video Model (only when outputMode === 'video') */}
          {outputMode === 'video' && (
            <VideoModelSelector
              credits={userCredits || 0}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              showIcon={true}
              hiddenModels={['auto']}
              disabledModels={disabledModels as Array<'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro'>}
              videoQuality={videoQuality}
              videoDuration={videoDuration}
              adsCount={1}
            />
          )}

          {/* Custom Prompt Input (only in custom mode) */}
          {generationMode === 'custom' && (
            <CustomPromptInput
              value={customPrompt}
              onChange={setCustomPrompt}
            />
          )}

          {/* Generate Button */}
          <button
            onClick={handleStartWorkflow}
            disabled={!selectedProduct || !selectedBrand}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate {outputMode === 'video' ? 'Video' : 'Image'} Ad
            <ArrowRight className="w-4 h-4" />
          </button>

          {!selectedProduct && (
            <p className="text-xs text-center text-gray-500">
              Please select a product to continue
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          {renderWorkflowContent()}
        </div>
      </main>
    </div>
  );
}
