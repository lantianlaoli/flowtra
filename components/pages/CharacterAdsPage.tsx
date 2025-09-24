'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/layout/Sidebar';
import UserPhotoGallery from '@/components/UserPhotoGallery';
import VideoDurationSelector from '@/components/ui/VideoDurationSelector';
import VideoModelSelector from '@/components/ui/VideoModelSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import ProductSelector from '@/components/ProductSelector';
import ProductManager from '@/components/ProductManager';
import { ArrowRight, Play, Clock, Video, Settings, Package } from 'lucide-react';
import { UserProduct } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export default function CharacterAdsPage() {
  const { user, isLoaded } = useUser();

  // Form state
  const [personImages, setPersonImages] = useState<File[]>([]);
  const [selectedPersonPhotoUrl, setSelectedPersonPhotoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<8 | 16 | 24>(8);
  const [selectedVideoModel, setSelectedVideoModel] = useState<'auto' | 'veo3' | 'veo3_fast'>('auto');
  const [selectedImageModel, setSelectedImageModel] = useState<'auto' | 'nano_banana' | 'seedream'>('auto');
  const [selectedProduct, setSelectedProduct] = useState<UserProduct | null>(null);
  const [showProductManager, setShowProductManager] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
interface CharacterAdsProject {
  id: string;
  current_step: string;
  status: string;
  progress_percentage: number;
  video_duration_seconds: number;
  has_analysis_result: boolean;
  has_generated_prompts: boolean;
  generated_image_url?: string;
  generated_video_count: number;
  kie_image_task_id?: string;
  kie_video_task_ids?: string[];
  fal_merge_task_id?: string;
  merged_video_url?: string;
  error_message?: string;
}

  const [currentProject, setCurrentProject] = useState<CharacterAdsProject | null>(null);

  const canStartGeneration = (personImages.length > 0 || selectedPersonPhotoUrl) && selectedProduct;

  // Polling function to check project status
  const pollProjectStatus = async (projectId: string) => {
    const maxPolls = 180; // 30 minutes max (10s intervals)
    let pollCount = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/character-ads/${projectId}/status`);
        if (!response.ok) return;

        const data = await response.json();
        const project = data.project;

        setCurrentProject(project);

        // If project is completed or failed, stop polling
        if (project.status === 'completed' || project.status === 'failed') {
          return;
        }

        // Continue polling if not completed and under max polls
        pollCount++;
        if (pollCount < maxPolls) {
          // Trigger next step if needed
          await triggerNextStep(projectId, project);

          setTimeout(poll, 10000); // Poll every 10 seconds
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Retry after longer interval
        if (pollCount < maxPolls) {
          setTimeout(poll, 20000);
        }
      }
    };

    // Start polling
    setTimeout(poll, 5000); // Initial delay
  };

  // Trigger next step in workflow if needed
  const triggerNextStep = async (projectId: string, project: CharacterAdsProject) => {
    try {
      let nextStep = null;

      // Determine next step based on current state
      switch (project.current_step) {
        case 'analyzing_images':
          if (project.status === 'analyzing_images') {
            nextStep = 'analyze_images';
          }
          break;
        case 'generating_prompts':
          if (project.status === 'analyzing_images') {
            nextStep = 'generate_prompts';
          }
          break;
        case 'generating_image':
          if (project.status === 'generating_prompts') {
            nextStep = 'generate_image';
          } else if (project.kie_image_task_id && !project.generated_image_url) {
            nextStep = 'check_image_status';
          }
          break;
        case 'generating_videos':
          if (project.generated_image_url && project.status === 'generating_image') {
            nextStep = 'generate_videos';
          } else if ((project.kie_video_task_ids?.length || 0) > 0 && project.generated_video_count < (project.kie_video_task_ids?.length || 0)) {
            nextStep = 'check_videos_status';
          }
          break;
        case 'merging_videos':
          if (project.generated_video_count > 0 && project.status === 'generating_videos') {
            nextStep = 'merge_videos';
          } else if (project.fal_merge_task_id && !project.merged_video_url) {
            nextStep = 'check_merge_status';
          }
          break;
      }

      if (nextStep) {
        await fetch(`/api/character-ads/${projectId}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: nextStep })
        });
      }
    } catch (error) {
      console.error('Error triggering next step:', error);
    }
  };

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
      formData.append('user_id', user.id);

      const response = await fetch('/api/character-ads/create', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      const project = await response.json();
      setCurrentProject(project);

          // Start polling for updates
      pollProjectStatus(project.id);

    } catch (error) {
      console.error('Failed to start generation:', error);
      alert('Failed to start generation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isLoaded) {
    return <div className="flex">Loading...</div>;
  }

  return (
    <div className="flex">
      <Sidebar
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="flex-1 ml-72 bg-white min-h-screen">
        <div className="max-w-5xl mx-auto p-8">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                Character Spokesperson Ads
              </h1>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed max-w-3xl">
              Create engaging video advertisements with AI-powered virtual spokespersons showcasing your products.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {showProductManager ? (
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
            ) : !currentProject ? (
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
            ) : (
              /* Generation Progress - Notion Style */
              <motion.div
                key="generation"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="p-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Generating Your Character Spokesperson Ad
                  </h2>
                  <p className="text-gray-600 mb-8">
                    Creating your AI-powered virtual spokesperson advertisement.
                  </p>

                  {/* Progress Bar - Notion Style */}
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-base font-medium text-gray-700">
                        {currentProject.current_step?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                      <span className="text-base font-bold text-gray-900">
                        {currentProject.progress_percentage || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <motion.div
                        className="bg-gradient-to-r from-gray-800 to-gray-900 h-3 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${currentProject.progress_percentage || 0}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  {/* Status Details - Notion Style Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Project Details
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium text-gray-900">{currentProject.video_duration_seconds}s</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Scenes:</span>
                          <span className="font-medium text-gray-900">{currentProject.video_duration_seconds / 8} video + 1 image</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className="font-medium text-gray-900 capitalize">{currentProject.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        Progress Checklist
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className={`flex items-center gap-2 ${currentProject.has_analysis_result ? 'text-green-600' : 'text-gray-400'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentProject.has_analysis_result ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                            {currentProject.has_analysis_result && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span>Image Analysis</span>
                        </div>
                        <div className={`flex items-center gap-2 ${currentProject.has_generated_prompts ? 'text-green-600' : 'text-gray-400'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentProject.has_generated_prompts ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                            {currentProject.has_generated_prompts && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span>Prompts Generated</span>
                        </div>
                        <div className={`flex items-center gap-2 ${currentProject.generated_image_url ? 'text-green-600' : 'text-gray-400'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentProject.generated_image_url ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                            {currentProject.generated_image_url && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span>Image Generated</span>
                        </div>
                        <div className={`flex items-center gap-2 ${currentProject.generated_video_count > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentProject.generated_video_count > 0 ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                            {currentProject.generated_video_count > 0 && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span>Videos ({currentProject.generated_video_count || 0}/{currentProject.video_duration_seconds / 8})</span>
                        </div>
                        <div className={`flex items-center gap-2 ${currentProject.merged_video_url ? 'text-green-600' : 'text-gray-400'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentProject.merged_video_url ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                            {currentProject.merged_video_url && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span>Final Video</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Results - Notion Style Success State */}
                  {currentProject.merged_video_url && (
                    <motion.div
                      className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Play className="w-8 h-8 text-white" />
                      </div>
                      <h4 className="text-2xl font-bold text-gray-900 mb-2">
                        Your Ad is Ready!
                      </h4>
                      <p className="text-gray-600 mb-8">
                        High-quality character spokesperson advertisement generated successfully.
                      </p>
                      <div className="max-w-2xl mx-auto mb-8">
                        <video
                          src={currentProject.merged_video_url}
                          controls
                          className="w-full rounded-xl shadow-lg"
                          preload="metadata"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <motion.a
                          href={currentProject.merged_video_url}
                          download
                          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-lg"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Download Video
                        </motion.a>
                        <motion.button
                          onClick={() => {
                            setCurrentProject(null);
                            setPersonImages([]);
                            setSelectedPersonPhotoUrl('');
                            setSelectedProduct(null);
                          }}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-8 rounded-xl transition-colors"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          Create Another
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* Error Display - Notion Style */}
                  {currentProject.status === 'failed' && currentProject.error_message && (
                    <motion.div
                      className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-white text-2xl">⚠</span>
                      </div>
                      <h4 className="text-2xl font-bold text-red-900 mb-2">Generation Failed</h4>
                      <p className="text-red-700 mb-6 max-w-md mx-auto">{currentProject.error_message}</p>
                      <motion.button
                        onClick={() => {
                          setCurrentProject(null);
                          setPersonImages([]);
                          setSelectedPersonPhotoUrl('');
                          setSelectedProduct(null);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-lg"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Start Over
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}