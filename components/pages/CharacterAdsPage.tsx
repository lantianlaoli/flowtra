'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import MultiFileUpload from '@/components/MultiFileUpload';
import VideoDurationSelector from '@/components/ui/VideoDurationSelector';
import VideoModelSelector from '@/components/ui/VideoModelSelector';
import ImageModelSelector from '@/components/ui/ImageModelSelector';
import { ArrowRight, Play, Clock, Users, Package } from 'lucide-react';
// import { AnimatePresence, motion } from 'framer-motion';

export default function CharacterAdsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();

  // Form state
  const [personImages, setPersonImages] = useState<File[]>([]);
  const [productImages, setProductImages] = useState<File[]>([]);
  const [videoDuration, setVideoDuration] = useState<8 | 16 | 24>(8);
  const [selectedVideoModel, setSelectedVideoModel] = useState<'auto' | 'veo3' | 'veo3_fast'>('auto');
  const [selectedImageModel, setSelectedImageModel] = useState<'auto' | 'nano_banana' | 'seedream'>('auto');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
interface CharacterAdsProject {
  id: string;
  current_step: string;
  status: string;
  progress_percentage: number;
  video_duration_seconds: number;
  credits_cost: number;
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

  const canStartGeneration = personImages.length > 0 && productImages.length > 0;

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

  // Calculate estimated credits cost
  const getCreditsEstimate = () => {
    const imageCredits = 1; // 1 for Scene 0 image generation
    const videoScenes = videoDuration / 8; // 8s per scene
    const videoCredits = videoScenes * (selectedVideoModel === 'veo3' ? 15 : 10); // Estimated costs
    return imageCredits + videoCredits;
  };

  const handleStartGeneration = async () => {
    if (!canStartGeneration || !user?.id) return;

    setIsGenerating(true);

    try {
      // Upload images first
      const formData = new FormData();
      personImages.forEach((file, index) => {
        formData.append(`person_image_${index}`, file);
      });
      productImages.forEach((file, index) => {
        formData.append(`product_image_${index}`, file);
      });
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
        credits={userCredits}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="flex-1 ml-72 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Long Video Ads
            </h1>
            <p className="text-gray-600 text-lg">
              Create engaging 8-24 second UGC-style video advertisements using AI. Upload person and product photos to generate complete ad campaigns.
            </p>
          </div>

          {!currentProject ? (
            <div className="space-y-8">
              {/* Upload Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Person Images */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Person Photos</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">
                    Upload photos of the person who will appear in your ad
                  </p>
                  <MultiFileUpload
                    onFilesSelected={setPersonImages}
                    accept="image/*"
                    multiple={true}
                    maxFiles={5}
                    label="Upload Person Images"
                    description="PNG, JPG up to 10MB each"
                  />
                  {personImages.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">
                      {personImages.length} image(s) selected
                    </p>
                  )}
                </div>

                {/* Product Images */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Product Photos</h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-4">
                    Upload photos of the product to be advertised
                  </p>
                  <MultiFileUpload
                    onFilesSelected={setProductImages}
                    accept="image/*"
                    multiple={true}
                    maxFiles={5}
                    label="Upload Product Images"
                    description="PNG, JPG up to 10MB each"
                  />
                  {productImages.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">
                      {productImages.length} image(s) selected
                    </p>
                  )}
                </div>
              </div>

              {/* Configuration Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Configuration</h3>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Video Duration */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-gray-600" />
                      <label className="text-sm font-medium text-gray-900">
                        Video Duration
                      </label>
                    </div>
                    <VideoDurationSelector
                      value={videoDuration}
                      onChange={setVideoDuration}
                    />
                  </div>

                  {/* Image Model */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      Image Model
                    </label>
                    <ImageModelSelector
                      selectedModel={selectedImageModel}
                      onModelChange={setSelectedImageModel}
                      credits={userCredits || 0}
                    />
                  </div>

                  {/* Video Model */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      Video Model
                    </label>
                    <VideoModelSelector
                      selectedModel={selectedVideoModel}
                      onModelChange={setSelectedVideoModel}
                      credits={userCredits || 0}
                    />
                  </div>
                </div>
              </div>

              {/* Credits & Generate */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Estimated Cost
                    </h3>
                    <p className="text-sm text-gray-600">
                      {videoDuration}s video = {videoDuration / 8} scene(s) + 1 image
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      ~{getCreditsEstimate()} credits
                    </div>
                    <p className="text-sm text-gray-600">
                      Your balance: {userCredits?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleStartGeneration}
                  disabled={!canStartGeneration || isGenerating}
                  className="w-full mt-6 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Generate Long Video Ad
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Generation Progress */
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Generating Your Long Video Ad
              </h2>

              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    {currentProject.current_step?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentProject.progress_percentage || 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${currentProject.progress_percentage || 0}%` }}
                  />
                </div>
              </div>

              {/* Status Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Project Details</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>Duration: {currentProject.video_duration_seconds}s</li>
                    <li>Scenes: {currentProject.video_duration_seconds / 8} video + 1 image</li>
                    <li>Status: {currentProject.status}</li>
                    <li>Credits: {currentProject.credits_cost}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Progress</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li className={currentProject.has_analysis_result ? 'text-green-600' : 'text-gray-400'}>
                      ✓ Image Analysis {currentProject.has_analysis_result ? 'Complete' : 'Pending'}
                    </li>
                    <li className={currentProject.has_generated_prompts ? 'text-green-600' : 'text-gray-400'}>
                      ✓ Prompts {currentProject.has_generated_prompts ? 'Generated' : 'Pending'}
                    </li>
                    <li className={currentProject.generated_image_url ? 'text-green-600' : 'text-gray-400'}>
                      ✓ Image {currentProject.generated_image_url ? 'Generated' : 'Pending'}
                    </li>
                    <li className={currentProject.generated_video_count > 0 ? 'text-green-600' : 'text-gray-400'}>
                      ✓ Videos ({currentProject.generated_video_count || 0}/{currentProject.video_duration_seconds / 8})
                    </li>
                    <li className={currentProject.merged_video_url ? 'text-green-600' : 'text-gray-400'}>
                      ✓ Final Video {currentProject.merged_video_url ? 'Ready' : 'Processing'}
                    </li>
                  </ul>
                </div>
              </div>

              {/* Results */}
              {currentProject.merged_video_url && (
                <div className="border-t pt-6">
                  <h4 className="font-medium text-gray-900 mb-4">Your Video is Ready!</h4>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <video
                      src={currentProject.merged_video_url}
                      controls
                      className="w-full max-w-md mx-auto rounded-lg"
                      preload="metadata"
                    />
                    <div className="mt-4 flex gap-2">
                      <a
                        href={currentProject.merged_video_url}
                        download
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Download Video
                      </a>
                      <button
                        onClick={() => {
                          setCurrentProject(null);
                          setPersonImages([]);
                          setProductImages([]);
                        }}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                      >
                        Create Another
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {currentProject.status === 'failed' && currentProject.error_message && (
                <div className="border-t pt-6">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-900 mb-2">Generation Failed</h4>
                    <p className="text-sm text-red-700">{currentProject.error_message}</p>
                    <button
                      onClick={() => {
                        setCurrentProject(null);
                        setPersonImages([]);
                        setProductImages([]);
                      }}
                      className="mt-3 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}