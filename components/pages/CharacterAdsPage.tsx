'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import UserPhotoGallery from '@/components/UserPhotoGallery';
import VideoDurationSelector from '@/components/ui/VideoDurationSelector';
import VideoModelSelector from '@/components/ui/VideoModelSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import SizeSelector from '@/components/ui/SizeSelector';
import AccentSelector, { AccentType } from '@/components/ui/AccentSelector';
import VideoAspectRatioSelector from '@/components/ui/VideoAspectRatioSelector';
import ProductSelector, { TemporaryProduct } from '@/components/ProductSelector';
import ProductManager from '@/components/ProductManager';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import { ArrowRight, Clock, Video, Settings, Package, History, MessageSquare, Sparkles, Wand2 } from 'lucide-react';
import { UserProduct } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ShowcaseSection from '@/components/ui/ShowcaseSection';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

export default function CharacterAdsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();
  const router = useRouter();

  // Form state
  const [personImages, setPersonImages] = useState<File[]>([]);
  const [selectedPersonPhotoUrl, setSelectedPersonPhotoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<8 | 10 | 16 | 20 | 24 | 30>(8);
  const [selectedVideoModel, setSelectedVideoModel] = useState<'auto' | 'veo3' | 'veo3_fast' | 'sora2'>('veo3_fast');
  const [selectedImageModel, setSelectedImageModel] = useState<'auto' | 'nano_banana' | 'seedream'>('seedream');
  const [imageSize, setImageSize] = useState<string>('auto');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [selectedAccent, setSelectedAccent] = useState<AccentType>('american');
  const [customDialogue, setCustomDialogue] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | TemporaryProduct | null>(null);
  const [showProductManager, setShowProductManager] = useState(false);
  const [isGeneratingDialogue, setIsGeneratingDialogue] = useState(false);
  const [dialogueError, setDialogueError] = useState<string | null>(null);
  const [hasAIGeneratedDialogue, setHasAIGeneratedDialogue] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [projectId, setProjectId] = useState<string | null>(null);

  // KIE credits state
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true
  });

  const canStartGeneration = (personImages.length > 0 || selectedPersonPhotoUrl) && selectedProduct;

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

  const isTemporaryProduct = (product: UserProduct | TemporaryProduct | null): product is TemporaryProduct => {
    return product !== null && 'isTemporary' in product && product.isTemporary === true;
  };

  const handleStartGeneration = async () => {
    if (!canStartGeneration || !user?.id) return;

    setIsGenerating(true);

    try {
      // Upload temporary product images to Supabase first if needed
      let productId = selectedProduct?.id;

      if (selectedProduct && isTemporaryProduct(selectedProduct)) {
        // Upload temporary images first
        const uploadFormData = new FormData();
        selectedProduct.uploadedFiles.forEach((file, index) => {
          uploadFormData.append(`file_${index}`, file);
        });

        const uploadResponse = await fetch('/api/upload-temp-images', {
          method: 'POST',
          body: uploadFormData,
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Failed to upload product images');
        }

        // For character ads, we'll pass the first image URL directly
        // Instead of using product_id, we'll use a temporary product URL
        productId = `temp:${uploadResult.imageUrls[0]}`;
      }

      // Upload images first
      const formData = new FormData();

      // Handle person images - either uploaded files or selected photo URL
      if (selectedPersonPhotoUrl) {
        formData.append('selected_person_photo_url', selectedPersonPhotoUrl);
      } else {
        personImages.forEach((file, index) => {
          formData.append(`person_image_${index}`, file);
        });
      }

      // Use selected product or temporary product URL
      if (productId) {
        formData.append('selected_product_id', productId);
      }
      formData.append('video_duration_seconds', videoDuration.toString());
      formData.append('image_model', selectedImageModel);
      formData.append('image_size', imageSize);
      formData.append('video_model', selectedVideoModel);
      formData.append('video_aspect_ratio', videoAspectRatio);
      formData.append('accent', selectedAccent);
      if (customDialogue && customDialogue.trim()) {
        formData.append('custom_dialogue', customDialogue.trim());
      }
      formData.append('user_id', user.id);

      const response = await fetch('/api/character-ads/create', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      const project = await response.json();
      setProjectId(project.id);
      setWorkflowStatus('success');

    } catch (error) {
      console.error('Failed to start generation:', error);
      setWorkflowStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetWorkflow = () => {
    setWorkflowStatus('idle');
    setProjectId(null);
    setPersonImages([]);
    setSelectedPersonPhotoUrl('');
    setSelectedProduct(null);
    setSelectedAccent('australian');
    setCustomDialogue('');
    setDialogueError(null);
    setHasAIGeneratedDialogue(false);
  };

  const productPhotoUrls = useMemo(() => {
    if (!selectedProduct?.user_product_photos?.length) return [] as string[];
    return selectedProduct.user_product_photos
      .map((photo) => photo.photo_url)
      .filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url))
      .slice(0, 3);
  }, [selectedProduct]);

  const canUseDialogueAI = !!selectedProduct && productPhotoUrls.length > 0;

  const handleGenerateAIDialogue = async () => {
    if (!selectedProduct) {
      setDialogueError('Select a product before generating a dialogue.');
      return;
    }

    if (productPhotoUrls.length === 0) {
      setDialogueError('Please add product photos first so AI can understand your item.');
      return;
    }

    setDialogueError(null);
    setIsGeneratingDialogue(true);

    const productName = selectedProduct.product_name || '';
    const productDescription = selectedProduct.description || '';

    try {
      const response = await fetch('/api/character-ads/dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accent: selectedAccent,
          productName,
          productDescription,
          productImageUrls: productPhotoUrls
        })
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to generate dialogue.');
      }

      setCustomDialogue(result.dialogue || '');
      setHasAIGeneratedDialogue(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate dialogue.';
      setDialogueError(message);
      setHasAIGeneratedDialogue(false);
    } finally {
      setIsGeneratingDialogue(false);
    }
  };

  const handleCustomDialogueChange = (value: string) => {
    setCustomDialogue(value);
    if (hasAIGeneratedDialogue) {
      setHasAIGeneratedDialogue(false);
    }
  };

  if (!isLoaded) {
    return <div className="flex">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={userCredits}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen pt-14 md:pt-0">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Video className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Character Ads
              </h1>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Check KIE credits first - if insufficient, show maintenance interface */}
            {!kieCreditsStatus.loading && !kieCreditsStatus.sufficient ? (
              <motion.div
                key="maintenance"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="max-w-xl mx-auto"
              >
                <MaintenanceMessage />
              </motion.div>
            ) : showProductManager ? (
              <motion.div
                key="product-manager"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-6">
                  <button
                    onClick={() => setShowProductManager(false)}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    ← Back to Character Ads
                  </button>
                </div>
                <ProductManager />
              </motion.div>
            ) : workflowStatus === 'idle' ? (
              <motion.div
                key="configuration"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-8"
              >
                {/* Left Column - Photos and Product Management */}
                <div className="space-y-6">
                  {/* Personal Photos */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <UserPhotoGallery
                      onPhotoSelect={setSelectedPersonPhotoUrl}
                      selectedPhotoUrl={selectedPersonPhotoUrl}
                    />
                  </div>

                  {/* Product Selection */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-700" />
                        <h3 className="text-lg font-semibold text-gray-900">Product Photos</h3>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <ProductSelector
                        selectedProduct={selectedProduct}
                        onProductSelect={setSelectedProduct}
                      />

                    </div>
                  </div>

                </div>

                {/* Right Column - Configuration and Generate */}
                <div className="space-y-6">
                  {/* Configuration Card */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible">
                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-gray-700" />
                        <h3 className="text-lg font-semibold text-gray-900">Configuration</h3>
                      </div>
                    </div>
                    <div className="p-6 space-y-6">

                      {/* Video Duration */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="w-4 h-4 text-gray-600" />
                          <label className="text-sm font-medium text-gray-700">
                            Video Duration
                          </label>
                        </div>
                        <VideoDurationSelector
                          value={videoDuration}
                          onChange={(d) => {
                            // Keep the chosen video model stable when duration changes
                            setVideoDuration(d);
                          }}
                        />
                      </div>

                      {/* Model Selection - Image and Video in one row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                        <div className="relative">
                          <ImageModelSelector
                            credits={9999}
                            selectedModel={selectedImageModel}
                            onModelChange={setSelectedImageModel}
                            showIcon={true}
                            hiddenModels={['auto']}
                          />
                        </div>
                        <div className="relative">
                          <VideoModelSelector
                            credits={9999}
                            selectedModel={selectedVideoModel}
                            onModelChange={(m) => setSelectedVideoModel(m)}
                            hideCredits={true}
                            showIcon={true}
                            disabledModels={(videoDuration === 10 || videoDuration === 20 || videoDuration === 30)
                              ? ['veo3', 'veo3_fast']
                              : ['sora2']}
                            hiddenModels={['auto']}
                          />
                        </div>
                      </div>

                      {/* Formats - Image size & Video aspect ratio in one row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <SizeSelector
                            selectedSize={imageSize}
                            onSizeChange={setImageSize}
                            imageModel={selectedImageModel === 'auto' ? 'seedream' : selectedImageModel}
                            videoAspectRatio={videoAspectRatio}
                            showIcon={true}
                          />
                        </div>
                        <div>
                          <VideoAspectRatioSelector
                            selectedAspectRatio={videoAspectRatio}
                            onAspectRatioChange={setVideoAspectRatio}
                            videoModel={selectedVideoModel}
                            showIcon={true}
                          />
                        </div>
                      </div>

                      {/* Voice Accent Selection */}
                      <div>
                        <AccentSelector
                          selectedAccent={selectedAccent}
                          onAccentChange={setSelectedAccent}
                          showIcon={true}
                        />
                      </div>

                      {/* Custom Dialogue (Optional) */}
                      <div className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                            <MessageSquare className="w-4 h-4 text-gray-600" />
                            <span>Custom Dialogue</span>
                            <span className="text-xs text-gray-500 font-medium">Optional</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleGenerateAIDialogue}
                            disabled={isGeneratingDialogue || !canUseDialogueAI}
                            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
                          >
                          {isGeneratingDialogue ? (
                            <>
                              <span className="h-3 w-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                              Generating…
                            </>
                          ) : hasAIGeneratedDialogue ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              Regenerate
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              AI Generate
                              {!canUseDialogueAI && (
                                <span
                                  className="ml-2 flex h-4 w-4 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-700"
                                  title={selectedProduct
                                    ? 'Upload at least one product photo so AI can understand your item before drafting dialogue.'
                                    : 'Pick a product with photos to unlock AI dialogue suggestions.'}
                                >
                                  ?
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      </div>
                        <div className="mt-3">
                          {dialogueError && (
                            <div className="mb-2 text-xs text-red-500">{dialogueError}</div>
                          )}
                          <div className="space-y-2">
                            <textarea
                              value={customDialogue}
                              onChange={(e) => handleCustomDialogueChange(e.target.value)}
                              placeholder="Add a short line the character will say. Think product hook + friendly CTA."
                              maxLength={200}
                              rows={3}
                              className="w-full px-3 py-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 text-gray-900 transition"
                            />
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <div className="inline-flex items-center gap-1 text-gray-600">
                                <Wand2 className="w-3.5 h-3.5" />
                                Tip: keep it under 200 characters for the most natural delivery.
                              </div>
                              <span>{customDialogue.length}/200</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Generate Button */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6">
                      <motion.button
                        onClick={handleStartGeneration}
                        disabled={!canStartGeneration || isGenerating}
                        className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white px-8 py-4 rounded-xl hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold group shadow-lg disabled:shadow-none"
                        whileHover={{ scale: canStartGeneration && !isGenerating ? 1.02 : 1 }}
                        whileTap={{ scale: canStartGeneration && !isGenerating ? 0.98 : 1 }}
                      >
                        {isGenerating ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            <span>Generating Ad…</span>
                          </>
                        ) : (
                          <>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-200" />
                            <span>Generate Ad</span>
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : workflowStatus === 'success' ? (
              /* Success State - Simple Notification */
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-2xl mx-auto text-center space-y-6"
              >
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
                    Your character spokesperson ad is being created. The process is now running in the background.
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
              </motion.div>
            ) : workflowStatus === 'error' ? (
              /* Error State */
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-2xl mx-auto text-center space-y-6"
              >
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl text-red-600">⚠</span>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Oops! Something went wrong
                  </h3>
                  <p className="text-gray-600 text-base">
                    We encountered an issue while processing your request. Please try again.
                  </p>
                </div>

                <button
                  onClick={() => resetWorkflow()}
                  className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium"
                >
                  Start Over
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Showcase Section */}
          <div className="mt-16">
            <ShowcaseSection workflowType="character-ads" />
          </div>
        </div>
      </div>
    </div>
  );
}
