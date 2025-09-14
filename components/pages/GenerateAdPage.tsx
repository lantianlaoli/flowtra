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
import { RotateCcw, ArrowRight, History, Tag, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { canAffordModel, CREDIT_COSTS } from '@/lib/constants';

interface KieCreditsStatus {
  sufficient: boolean;
  loading: boolean;
  currentCredits?: number;
  threshold?: number;
}

export default function GenerateAdPage() {
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

  const getHumanizedStepMessage = (step: string | null) => {
    if (step === 'describing') {
      return `Getting to know your product...`;
    }
    if (step === 'generating_prompts') {
      return `Crafting your ad concept...`;
    }
    if (step === 'generating_cover') {
      return `Designing your visuals...`;
    }
    if (step === 'generating_video') {
      return `Bringing it all together...`;
    }
    return `Processing...`;
  };

  const getStepDisplayName = (step: string | null) => {
    if (step === 'describing') {
      return 'Understanding Product';
    }
    if (step === 'generating_prompts') {
      return 'Creating Concept';
    }
    if (step === 'generating_cover') {
      return 'Designing Visuals';
    }
    if (step === 'generating_video') {
      return 'Finalizing Ad';
    }
    return 'Processing';
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

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
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium relative overflow-hidden group"
                >
                  {state.isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span className="animate-pulse">Creating magic...</span>
                      {/* Animated background effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                      <span className="group-hover:scale-105 transition-transform duration-200">Create Ad</span>
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
                  placeholder="Add watermark (optional)"
                  maxLength={20}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Make it yours with a custom watermark
                </p>
              </div>

              {/* Future configuration options can be added here */}
              <div className="text-center text-gray-400 py-8">
                <Tag className="w-8 h-8 mx-auto mb-3" />
                <p className="text-sm">More options coming soon</p>
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
              Ad Creation Started
            </h3>
            <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
              Your ad is being created. The process is now running in the background.
            </p>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/dashboard/videos')}
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
              Create Another
            </button>
          </div>
        </div>
      );
    }

    // For processing workflow, show progress page
    if (state.workflowStatus === 'in_progress' || state.workflowStatus === 'failed') {
      return (
        <div className="max-w-xl mx-auto text-center space-y-6 animate-bounce-in">
          <div className="relative">
            {state.workflowStatus === 'failed' ? (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto animate-pulse-glow">
                <span className="text-2xl text-red-600">✗</span>
              </div>
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto animate-float">
                <div className="relative">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-0 w-8 h-8 border-4 border-transparent border-r-white rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 animate-slide-in-left">
              {state.workflowStatus === 'failed' ? 'Oops! Something went wrong' : 'Creating your masterpiece...'}
            </h3>
            <p className="text-gray-600 text-base animate-slide-in-right">
              {state.workflowStatus === 'failed' 
                ? `We encountered an issue: ${state.error || state.data.errorMessage || 'Unknown error occurred'}`
                : getHumanizedStepMessage(state.currentStep)
              }
            </p>
            {state.workflowStatus === 'in_progress' && (
              <div className="space-y-3 animate-slide-in-left">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-700 ease-out relative overflow-hidden" 
                    style={{ width: `${state.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span className="font-medium">{getStepDisplayName(state.currentStep)}</span>
                  <span className="font-bold text-blue-600">{state.progress}%</span>
                </div>
              </div>
            )}
          </div>
          
          {state.workflowStatus === 'failed' && (
            <div className="pt-4 animate-slide-in-right">
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      );
    }

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
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">Ready to download and share!</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-in-right">
            <button
              onClick={() => router.push('/dashboard/videos')}
              className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-6 py-3 rounded-lg hover:from-gray-800 hover:to-gray-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <History className="w-4 h-4" />
              View Results
            </button>
            <button
              onClick={() => resetWorkflow()}
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-medium"
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
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-gray-700" />
                </div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Create Professional Video Ads
                </h1>
              </div>
              <p className="text-gray-600 text-sm ml-11">
                Transform your product photos into compelling video advertisements that drive sales
              </p>
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
          <div className="bg-white border border-gray-200 rounded-lg p-8">
            {renderWorkflowContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
