'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import FileUpload from '@/components/FileUpload';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import InsufficientCredits from '@/components/InsufficientCredits';
import { Download, RotateCcw, Share2, ArrowRight, History, Tag, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { canAffordModel, CREDIT_COSTS } from '@/lib/constants';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, updateCredits, refetchCredits } = useCredits();
  const [selectedModel, setSelectedModel] = useState<'auto' | 'veo3' | 'veo3_fast'>('auto');
  const [kieCreditsStatus, setKieCreditsStatus] = useState<KieCreditsStatus>({
    sufficient: true,
    loading: true
  });
  const [watermarkText, setWatermarkText] = useState('');
  
  const handleModelChange = (model: 'auto' | 'veo3' | 'veo3_fast') => {
    setSelectedModel(model);
  };
  const router = useRouter();
  
  const {
    state,
    uploadFile,
    startWorkflowWithConfig,
    resetWorkflow
  } = useWorkflow(user?.id, selectedModel, updateCredits, refetchCredits);

  // No longer redirect non-authenticated users - allow guest access
  // Guest users get limited usage (1 VEO3_fast), logged-in users get more (2 VEO3_fast)

  // Credits are now managed by CreditsContext

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

  const getStepMessage = (step: string | null) => {
    const stepMessages = {
      'describing': 'Analyzing your product image with AI...',
      'generating_prompts': 'Creating creative advertisement concepts...',
      'generating_cover': 'Designing your advertisement cover...',
      'generating_video': 'Producing your video advertisement...'
    };
    return stepMessages[step as keyof typeof stepMessages] || 'Processing...';
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Allow both authenticated and guest users to access dashboard

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
      enabled: watermarkText.trim().length > 0,
      text: watermarkText.trim()
    };
    
    await startWorkflowWithConfig(watermarkConfig);
  };

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
    console.log('🔍 Credits check:', {
      userCredits,
      selectedModel,
      canAffordAuto: canAffordModel(userCredits || 0, 'auto'),
      canAffordVeo3Fast: canAffordModel(userCredits || 0, 'veo3_fast'),
      canAffordVeo3: canAffordModel(userCredits || 0, 'veo3'),
      requiredForAuto: CREDIT_COSTS.veo3_fast
    });
    
    if (userCredits !== undefined && !canAffordModel(userCredits, 'auto')) {
      return <InsufficientCredits currentCredits={userCredits} requiredCredits={CREDIT_COSTS.veo3_fast} />;
    }
    
    // Show upload interface when no workflow is running
    if (state.workflowStatus === 'started') {
      return (
        <div className="max-w-4xl mx-auto">
          <FileUpload onFileUpload={handleFileUpload} isLoading={state.isLoading} multiple={false} />
        </div>
      );
    }

    // Show watermark configuration interface after upload
    if (state.workflowStatus === 'uploaded_waiting_config') {
      return (
        <div className="max-w-6xl mx-auto">
          {/* Left-Right Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side - Image Preview and Action Buttons */}
            <div className="space-y-6">
              {/* Image Preview */}
              {state.data.uploadedFile?.url && (
                <div className="text-center">
                  <Image 
                    src={state.data.uploadedFile.url} 
                    alt="Product" 
                    width={500}
                    height={500}
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleStartWorkflow}
                  disabled={state.isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {state.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5" />
                      Generate Video
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    // Create a hidden file input and trigger it
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

            {/* Right Side - Configuration Area */}
            <div className="space-y-6">
              {/* Watermark Input */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">Configuration</h3>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="Watermark text (optional)"
                  maxLength={20}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Add your brand watermark to the generated video
                </p>
              </div>

              {/* Future configuration options can be added here */}
              <div className="text-center text-gray-400 py-8">
                <Tag className="w-8 h-8 mx-auto mb-3" />
                <p className="text-sm">More configuration options coming soon</p>
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
              Advertisement Generation Started
            </h3>
            <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
              Your advertisement is being created. The process is now running in the background.
            </p>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/dashboard/history')}
              className="flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              <History className="w-4 h-4" />
              View Progress
            </button>
            <button
              onClick={() => resetWorkflow()}
              className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium"
            >
              <ArrowRight className="w-4 h-4" />
              Create Another Ad
            </button>
          </div>
        </div>
      );
    }

    if (state.workflowStatus === 'completed') {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-4">
              Video Generated Successfully
            </h1>
            <p className="text-gray-600 max-w-xl mx-auto">
              Your advertisement video has been created and is ready to download.
            </p>
          </div>
          
          {/* Original Image and Video Result */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 max-w-4xl mx-auto">
            {/* Original Image */}
            {state.data.uploadedFile?.url && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Original Product</h3>
                <Image 
                  src={state.data.uploadedFile.url} 
                  alt="Original product" 
                  width={400}
                  height={400}
                  className="w-full rounded-lg"
                />
              </div>
            )}

            {/* Generated Video */}
            {state.data.video?.url && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Generated Video</h3>
                  <a
                    href={state.data.video.url}
                    download="flowtra-video.mp4"
                    className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
                <div className="relative">
                  <video 
                    src={state.data.video.url} 
                    controls 
                    className="w-full rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Campaign Details */}
          {state.data.creativePrompts && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8 max-w-4xl mx-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">Advertisement Caption</h4>
                  <p className="text-gray-600 text-sm">{state.data.creativePrompts.caption}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">Creative Strategy</h4>
                  <p className="text-gray-600 text-sm">{state.data.creativePrompts.creative_summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Create Another Ad
            </button>
            <button
              onClick={() => window.open('mailto:?subject=Check out my AI-generated ad!&body=I just created this amazing advertisement using AI!')}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share Results
            </button>
          </div>
        </div>
      );
    }

    // For processing workflow, show progress page
    if (state.workflowStatus === 'in_progress' || state.workflowStatus === 'failed') {
      return (
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto">
            <span className="text-2xl">✓</span>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              {state.workflowStatus === 'failed' ? 'Processing Failed' : 'Processing Your Advertisement'}
            </h3>
            <p className="text-gray-600 text-sm">
              {state.workflowStatus === 'failed' 
                ? `Error: ${state.error || state.data.errorMessage || 'Unknown error occurred'}`
                : `Progress: ${state.progress}% - ${getStepMessage(state.currentStep)}`
              }
            </p>
            {state.workflowStatus === 'in_progress' && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${state.progress}%` }}
                ></div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/dashboard/history')}
              className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <History className="w-4 h-4" />
              View Progress
            </button>
            {state.workflowStatus === 'failed' ? (
              <button
                onClick={() => resetWorkflow()}
                className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Try Again
              </button>
            ) : (
              <button
                onClick={() => resetWorkflow()}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
                Upload More
              </button>
            )}
          </div>
        </div>
      );
    }

    // Hide all processing steps from user
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        credits={userCredits} 
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="ml-64 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Upload className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Upload Product Photo
              </h1>
            </div>
            <p className="text-gray-500 text-base max-w-2xl">
              Create professional AI-powered advertisements for your products
            </p>
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
          <div className="bg-white border border-gray-200 rounded-lg p-8">
            {renderWorkflowContent()}
          </div>
        </div>
      </div>
    </div>
  );
}