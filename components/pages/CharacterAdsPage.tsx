'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import UserPhotoGallery from '@/components/UserPhotoGallery';
import VideoDurationSelector from '@/components/ui/VideoDurationSelector';
import VideoModelSelector from '@/components/ui/VideoModelSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import AccentSelector, { AccentType } from '@/components/ui/AccentSelector';
import VideoAspectRatioSelector from '@/components/ui/VideoAspectRatioSelector';
import ProductSelector from '@/components/ProductSelector';
import ProductManager from '@/components/ProductManager';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import { ArrowRight, Clock, Video, Settings, Package, History } from 'lucide-react';
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
  const [videoDuration, setVideoDuration] = useState<8 | 16 | 24>(8);
  const [selectedVideoModel, setSelectedVideoModel] = useState<'auto' | 'veo3' | 'veo3_fast'>('auto');
  const [selectedImageModel, setSelectedImageModel] = useState<'auto' | 'nano_banana' | 'seedream'>('auto');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [selectedAccent, setSelectedAccent] = useState<AccentType>('australian');
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | null>(null);
  const [showProductManager, setShowProductManager] = useState(false);

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

  const handleStartGeneration = async () => {
    if (!canStartGeneration || !user?.id) return;

    setIsGenerating(true);

    try {
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
      
      // Use selected product instead of uploaded images
      if (selectedProduct) {
        formData.append('selected_product_id', selectedProduct.id);
      }
      formData.append('video_duration_seconds', videoDuration.toString());
      formData.append('image_model', selectedImageModel);
      formData.append('video_model', selectedVideoModel);
      formData.append('video_aspect_ratio', videoAspectRatio);
      formData.append('accent', selectedAccent);
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

      <div className="ml-72 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Video className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Character Spokesperson Ads
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
                        onManageProducts={() => setShowProductManager(true)}
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
                          onChange={setVideoDuration}
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
                          />
                        </div>
                        <div className="relative">
                          <VideoModelSelector
                            credits={9999}
                            selectedModel={selectedVideoModel}
                            onModelChange={setSelectedVideoModel}
                            hideCredits={true}
                            showIcon={true}
                          />
                        </div>
                      </div>

                      {/* Video Aspect Ratio */}
                      <div>
                        <VideoAspectRatioSelector
                          selectedAspectRatio={videoAspectRatio}
                          onAspectRatioChange={setVideoAspectRatio}
                          showIcon={true}
                        />
                      </div>

                      {/* Voice Accent Selection */}
                      <div>
                        <AccentSelector
                          selectedAccent={selectedAccent}
                          onAccentChange={setSelectedAccent}
                          showIcon={true}
                        />
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
                            <span className="ml-2 text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">Free</span>
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