'use client';

import { useState } from 'react';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import FileUpload from '@/components/FileUpload';
import MaintenanceMessage from '@/components/MaintenanceMessage';
import { Download, RotateCcw, Share2, ArrowRight, History } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();
  const [selectedModel, setSelectedModel] = useState<'auto' | 'veo3' | 'veo3_fast'>('auto');
  
  const handleModelChange = (model: 'auto' | 'veo3' | 'veo3_fast') => {
    setSelectedModel(model);
  };
  const router = useRouter();
  
  const {
    state,
    uploadFile,
    resetWorkflow
  } = useWorkflow(user?.id, selectedModel);

  // No longer redirect non-authenticated users - allow guest access
  // Guest users get limited usage (1 VEO3_fast), logged-in users get more (2 VEO3_fast)

  // Credits are now managed by CreditsContext

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

  const renderWorkflowContent = () => {
    // Show upload interface when no workflow is running
    if (!state.historyId || state.workflowStatus === 'started') {
      return (
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl font-medium text-gray-900 mb-2">
              Create your advertisements
            </h2>
            <p className="text-gray-600">
              Upload a product image to generate professional video ads with AI
            </p>
          </div>
          
          <FileUpload onFileUpload={handleFileUpload} isLoading={state.isLoading} multiple={false} />
        </div>
      );
    }

    // Show workflow initiated success state
    if (state.workflowStatus === 'workflow_initiated') {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8">
            <div className="text-center space-y-6">
              {/* Success icon */}
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto border-4 border-green-200">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              {/* Success message */}
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                  Advertisement Generation Started
                </h3>
                <p className="text-gray-700 text-base leading-relaxed mb-4">
                  Your AI-powered advertisement is now being created. Our system is analyzing your product and generating professional video content.
                </p>
                <div className="bg-white/60 rounded-lg p-4 border border-green-200/50">
                  <p className="text-sm text-gray-600">
                    <strong>Estimated time:</strong> 3-5 minutes • 
                    <strong> Process:</strong> Product analysis → Creative concepts → Cover design → Video generation
                  </p>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <button
                  onClick={() => router.push('/dashboard/history')}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                >
                  <History className="w-4 h-4" />
                  Watch Progress Live
                </button>
                <button
                  onClick={() => resetWorkflow()}
                  className="flex items-center justify-center gap-2 bg-white text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium border border-gray-300 shadow-sm"
                >
                  <ArrowRight className="w-4 h-4" />
                  Create Another Ad
                </button>
              </div>
            </div>
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
                <img 
                  src={state.data.uploadedFile.url} 
                  alt="Original product" 
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
        <div className="max-w-xl mx-auto">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-2xl">✓</span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {state.workflowStatus === 'failed' ? 'Processing Failed' : 'Processing Your Advertisement'}
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                {state.workflowStatus === 'failed' 
                  ? `Error: ${state.error || state.data.errorMessage || 'Unknown error occurred'}`
                  : `Progress: ${state.progress}% - ${getStepMessage(state.currentStep)}`
                }
              </p>
              {state.workflowStatus === 'in_progress' && (
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
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
        <div className="p-8">
          <div className="mb-10">
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">
              Upload Product Photo
            </h1>
            <p className="text-gray-500 text-sm">
              Create professional AI-powered advertisements for your products
            </p>
          </div>


          {/* Error Display */}
          {state.error && (
            <div className="mb-8">
              {state.error.includes('服务器维护中') ? (
                <MaintenanceMessage message={state.error} />
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