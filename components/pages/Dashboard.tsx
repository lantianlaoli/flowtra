'use client';

import { useEffect, useState } from 'react';
import { useWorkflow, WorkflowStep } from '@/hooks/useWorkflow';
import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/layout/Sidebar';
import FileUpload from '@/components/FileUpload';
import StepIndicator from '@/components/StepIndicator';
import { Upload, Play, Image, FileText, Zap } from 'lucide-react';

export default function Dashboard() {
  const { user, isLoaded } = useUser();
  const {
    state,
    uploadFile,
    retryFromStep,
    checkCoverStatus,
    checkVideoStatus
  } = useWorkflow();
  
  const [viewingStep, setViewingStep] = useState<WorkflowStep | null>(null);
  const [userCredits, setUserCredits] = useState<number>();

  // Poll for cover and video completion
  useEffect(() => {
    if (state.data.coverImage?.taskId && !state.data.coverImage.url) {
      const interval = setInterval(checkCoverStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [state.data.coverImage, checkCoverStatus]);

  useEffect(() => {
    if (state.data.video?.taskId && !state.data.video.url) {
      const interval = setInterval(checkVideoStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [state.data.video, checkVideoStatus]);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, user]);

  // Fetch user credits
  useEffect(() => {
    // TODO: Implement getUserCredits API call
    setUserCredits(2000); // Mock data
  }, []);

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  const renderWorkflowContent = () => {
    if (state.currentStep === 'upload') {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-gray-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Upload Your Product Image
            </h2>
            <p className="text-lg text-gray-600">
              Upload a high-quality image of your product. Our AI will automatically analyze it and create amazing advertisements for you.
            </p>
          </div>
          <FileUpload onFileUpload={uploadFile} isLoading={state.isLoading} />
        </div>
      );
    }

    if (state.currentStep === 'complete') {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              🎉 Advertisement Created Successfully!
            </h2>
            <p className="text-lg text-gray-600">
              Your AI-generated advertisement is ready! Here are your final results:
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {state.data.coverImage?.url && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Image className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Cover Image</h3>
                </div>
                <img 
                  src={state.data.coverImage.url} 
                  alt="Generated cover" 
                  className="w-full rounded-lg shadow-sm mb-4"
                />
                <a
                  href={state.data.coverImage.url}
                  download="flowtra-cover.jpg"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download Cover
                </a>
              </div>
            )}

            {state.data.video?.url && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Play className="w-5 h-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Video Advertisement</h3>
                </div>
                <video 
                  src={state.data.video.url} 
                  controls 
                  className="w-full rounded-lg shadow-sm mb-4"
                />
                <a
                  href={state.data.video.url}
                  download="flowtra-video.mp4"
                  className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Download Video
                </a>
              </div>
            )}
          </div>

          {/* Campaign Details */}
          {state.data.prompts && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">Campaign Details</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Caption</h4>
                  <p className="text-gray-700">{state.data.prompts.caption}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Creative Summary</h4>
                  <p className="text-gray-700">{state.data.prompts.creative_summary}</p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-900 text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Create Another Advertisement
            </button>
          </div>
        </div>
      );
    }

    // Processing steps
    return (
      <div className="max-w-2xl mx-auto">
        {state.data.uploadedFile && (
          <div className="text-center mb-8">
            <img 
              src={state.data.uploadedFile.url} 
              alt="Uploaded product" 
              className="max-w-xs mx-auto rounded-lg shadow-lg"
            />
          </div>
        )}
        
        <div className="text-center">
          {state.currentStep === 'describe' && (
            <div className="mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Analyzing Your Product</h2>
              <p className="text-gray-600">Our AI is examining your product image to understand its features and characteristics.</p>
            </div>
          )}
          
          {state.currentStep === 'generate-prompts' && (
            <div className="mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Creating Advertisement Concept</h2>
              <p className="text-gray-600">Generating creative briefs and concepts for your advertisement.</p>
              {state.data.description && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6 text-left">
                  <h3 className="font-semibold text-gray-900 mb-2">Product Analysis:</h3>
                  <p className="text-sm text-gray-700">{state.data.description}</p>
                </div>
              )}
            </div>
          )}
          
          {state.currentStep === 'generate-cover' && (
            <div className="mb-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Generating Cover Image</h2>
              <p className="text-gray-600 mb-4">Creating a professional advertisement image for your product. This may take a few minutes...</p>
              {state.data.prompts && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-gray-900 mb-2">Creative Concept:</h3>
                  <p className="text-sm text-gray-700">{state.data.prompts.creative_summary}</p>
                </div>
              )}
            </div>
          )}
          
          {state.currentStep === 'generate-video' && (
            <div className="mb-8">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Creating Video Advertisement</h2>
              <p className="text-gray-600 mb-4">Generating an engaging video advertisement for your product. This may take several minutes...</p>
              {state.data.coverImage?.url && (
                <div className="mb-4">
                  <img 
                    src={state.data.coverImage.url} 
                    alt="Generated cover" 
                    className="max-w-sm mx-auto rounded-lg shadow-md"
                  />
                  <p className="text-sm text-green-600 mt-2 font-medium">✓ Cover image completed</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar credits={userCredits} />
      
      <div className="flex-1">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Workspace
            </h1>
            <p className="text-gray-600">
              Create professional AI-powered advertisements for your products
            </p>
          </div>

          {/* Step Indicator */}
          <div className="mb-8">
            <StepIndicator 
              currentStep={state.currentStep} 
              isLoading={state.isLoading}
              stepResults={state.stepResults}
              selectedStep={viewingStep}
              onStepClick={(step) => {
                setViewingStep(viewingStep === step ? null : step);
              }}
            />
          </div>

          {/* Error Display */}
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg mb-8">
              <strong>Error:</strong> {state.error}
              {state.currentStep !== 'upload' && (
                <button
                  onClick={() => retryFromStep(state.currentStep)}
                  className="ml-4 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Main Content */}
          <div className="bg-white border border-gray-200 rounded-xl p-8">
            {renderWorkflowContent()}
          </div>
        </div>
      </div>
    </div>
  );
}