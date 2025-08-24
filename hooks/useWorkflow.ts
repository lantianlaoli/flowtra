import { useState, useCallback } from 'react';

export type WorkflowStep = 'upload' | 'describe' | 'generate-prompts' | 'generate-cover' | 'generate-video' | 'complete';

export interface StepResult {
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: any;
  error?: string;
  timestamp?: number;
  canView?: boolean;
}

export interface WorkflowState {
  currentStep: WorkflowStep;
  isLoading: boolean;
  error: string | null;
  stepResults: Record<WorkflowStep, StepResult>;
  data: {
    uploadedFile?: {
      url: string;
      path?: string;
    };
    description?: string;
    prompts?: {
      image_prompt: string;
      video_prompt: any;
      caption: string;
      creative_summary: string;
      aspect_ratio: string;
      video_model: string;
    };
    coverImage?: {
      taskId: string;
      url?: string;
      status?: 'pending' | 'processing' | 'completed' | 'error';
    };
    video?: {
      taskId: string;
      url?: string;
      status?: 'pending' | 'processing' | 'completed' | 'error';
    };
    historyId?: string;
  };
}

export const useWorkflow = () => {
  const [state, setState] = useState<WorkflowState>({
    currentStep: 'upload',
    isLoading: false,
    error: null,
    stepResults: {
      upload: { status: 'pending', canView: false },
      describe: { status: 'pending', canView: false },
      'generate-prompts': { status: 'pending', canView: false },
      'generate-cover': { status: 'pending', canView: false },
      'generate-video': { status: 'pending', canView: false },
      complete: { status: 'pending', canView: false }
    },
    data: {}
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading, error: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, isLoading: false, error }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => {
      const steps: WorkflowStep[] = ['upload', 'describe', 'generate-prompts', 'generate-cover', 'generate-video', 'complete'];
      const currentIndex = steps.indexOf(prev.currentStep);
      const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
      return { 
        ...prev, 
        currentStep: steps[nextIndex],
        error: null
      };
    });
  }, []);

  const updateData = useCallback((newData: Partial<WorkflowState['data']>) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, ...newData }
    }));
  }, []);

  const updateStepResult = useCallback((step: WorkflowStep, result: Partial<StepResult>) => {
    setState(prev => ({
      ...prev,
      stepResults: {
        ...prev.stepResults,
        [step]: {
          ...prev.stepResults[step],
          ...result,
          timestamp: Date.now()
        }
      }
    }));
  }, []);

  const runAutoWorkflow = useCallback(async (uploadedFileUrl: string) => {
    try {
      // Step 2: Describe image
      setState(prev => ({ ...prev, currentStep: 'describe', isLoading: true, error: null }));
      updateStepResult('describe', { status: 'processing' });
      
      const describeResponse = await fetch('/api/describe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: uploadedFileUrl }),
      });

      const describeResult = await describeResponse.json();
      if (!describeResult.success) {
        updateStepResult('describe', { status: 'error', error: describeResult.error });
        throw new Error(describeResult.error || 'Description failed');
      }

      updateData({ description: describeResult.description });
      updateStepResult('describe', { 
        status: 'completed', 
        data: { description: describeResult.description },
        canView: true 
      });

      // Step 3: Generate prompts
      setState(prev => ({ ...prev, currentStep: 'generate-prompts' }));
      updateStepResult('generate-prompts', { status: 'processing' });
      
      const promptsResponse = await fetch('/api/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productDescription: describeResult.description }),
      });

      const promptsResult = await promptsResponse.json();
      if (!promptsResult.success) {
        updateStepResult('generate-prompts', { status: 'error', error: promptsResult.error });
        throw new Error(promptsResult.error || 'Prompt generation failed');
      }

      updateData({ prompts: promptsResult.prompts });
      updateStepResult('generate-prompts', { 
        status: 'completed', 
        data: { prompts: promptsResult.prompts },
        canView: true 
      });

      // Step 4: Generate cover
      setState(prev => ({ ...prev, currentStep: 'generate-cover' }));
      updateStepResult('generate-cover', { status: 'processing' });
      
      const coverResponse = await fetch('/api/generate-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageUrl: uploadedFileUrl,
          imagePrompt: promptsResult.prompts.image_prompt
        }),
      });

      if (!coverResponse.ok) {
        // Handle server errors (5xx) - stop loading and show error
        const errorText = coverResponse.status >= 500 ? 
          'Server error occurred. Please try again later.' : 
          'Cover generation failed.';
        
        updateStepResult('generate-cover', { status: 'error', error: errorText });
        setLoading(false);
        setError(errorText);
        return;
      }

      const coverResult = await coverResponse.json();
      if (!coverResult.success) {
        // Check if it's a maintenance error
        const errorMessage = coverResult.maintenance ? 
          coverResult.error : 
          coverResult.error || 'Cover generation failed';
        
        updateStepResult('generate-cover', { status: 'error', error: errorMessage });
        setLoading(false);
        setError(errorMessage);
        return;
      }

      updateData({ 
        coverImage: { 
          taskId: coverResult.taskId,
          url: undefined,
          status: 'processing'
        } 
      });

      // Don't move to video step until cover polling starts
      // Cover polling will handle the transition
      
    } catch (error: any) {
      setError(error.message || 'Workflow failed');
      setLoading(false);
    }
  }, [updateData, setError, setLoading, updateStepResult]);

  const uploadFile = useCallback(async (file: File) => {
    setLoading(true);
    updateStepResult('upload', { status: 'processing' });
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        updateStepResult('upload', { status: 'error', error: result.error });
        throw new Error(result.error || 'Upload failed');
      }

      updateData({
        uploadedFile: {
          url: result.fileUrl,
          path: result.path
        }
      });
      
      updateStepResult('upload', { 
        status: 'completed', 
        data: { fileUrl: result.fileUrl, path: result.path },
        canView: true 
      });
      
      // Start automatic workflow
      runAutoWorkflow(result.fileUrl);
      
    } catch (error: any) {
      setError(error.message || 'Upload failed');
      setLoading(false);
    }
  }, [updateData, setError, setLoading, runAutoWorkflow, updateStepResult]);

  // Retry functions for failed steps
  const retryFromStep = useCallback(async (step: WorkflowStep) => {
    if (!state.data.uploadedFile?.url) {
      setError('No uploaded file found');
      return;
    }

    setState(prev => ({ ...prev, currentStep: step, isLoading: true, error: null }));

    switch (step) {
      case 'describe':
        try {
          const response = await fetch('/api/describe-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: state.data.uploadedFile.url }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.error);
          updateData({ description: result.description });
          runAutoWorkflow(state.data.uploadedFile.url);
        } catch (error: any) {
          setError(error.message);
          setLoading(false);
        }
        break;
      case 'generate-prompts':
        if (!state.data.description) {
          setError('No product description available');
          setLoading(false);
          return;
        }
        try {
          const response = await fetch('/api/generate-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productDescription: state.data.description }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.error);
          updateData({ prompts: result.prompts });
          // Continue workflow from cover generation
          setState(prev => ({ ...prev, currentStep: 'generate-cover' }));
          // Continue with remaining steps...
        } catch (error: any) {
          setError(error.message);
          setLoading(false);
        }
        break;
      // Add other retry cases as needed
    }
  }, [state.data, runAutoWorkflow, updateData, setError, setLoading]);

  const checkCoverStatus = useCallback(async () => {
    if (!state.data.coverImage?.taskId) return;

    try {
      const response = await fetch(`/api/generate-cover?taskId=${state.data.coverImage.taskId}`);
      const result = await response.json();

      if (result.success) {
        if (result.status === 'SUCCESS' && result.imageUrl) {
          updateData({
            coverImage: {
              ...state.data.coverImage,
              url: result.imageUrl,
              status: 'completed'
            }
          });
          
          updateStepResult('generate-cover', {
            status: 'completed',
            data: { imageUrl: result.imageUrl },
            canView: true
          });

          // Now start video generation
          if (state.currentStep === 'generate-cover' && state.data.prompts) {
            setState(prev => ({ ...prev, currentStep: 'generate-video' }));
            updateStepResult('generate-video', { status: 'processing' });
            
            try {
              const videoResponse = await fetch('/api/generate-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  videoPrompt: state.data.prompts.video_prompt,
                  coverImageUrl: result.imageUrl,
                  historyId: state.data.historyId
                }),
              });

              if (!videoResponse.ok) {
                // Handle server errors (5xx) - show error but don't stop overall flow
                const errorText = videoResponse.status >= 500 ? 
                  'Server error occurred during video generation.' : 
                  'Video generation failed.';
                updateStepResult('generate-video', { status: 'error', error: errorText });
                return;
              }

              const videoResult = await videoResponse.json();
              if (videoResult.success) {
                updateData({ 
                  video: { 
                    taskId: videoResult.taskId,
                    url: undefined,
                    status: 'processing'
                  },
                  historyId: videoResult.historyId || state.data.historyId
                });
              } else {
                // Check if it's a maintenance error
                const errorMessage = videoResult.maintenance ? 
                  videoResult.error : 
                  videoResult.error || 'Video generation failed';
                updateStepResult('generate-video', { status: 'error', error: errorMessage });
              }
            } catch (videoError: any) {
              updateStepResult('generate-video', { status: 'error', error: videoError.message });
            }
          }
        } else if (result.status === 'FAILED') {
          updateData({
            coverImage: {
              ...state.data.coverImage,
              status: 'error'
            }
          });
          updateStepResult('generate-cover', { status: 'error', error: result.error || 'Cover generation failed' });
        }
      }
    } catch (error: any) {
      console.error('Failed to check cover status:', error);
      updateStepResult('generate-cover', { status: 'error', error: error.message });
    }
  }, [state.data.coverImage, state.data.prompts, state.currentStep, updateData, updateStepResult]);

  const checkVideoStatus = useCallback(async () => {
    if (!state.data.video?.taskId) return;

    try {
      const queryParams = new URLSearchParams({
        taskId: state.data.video.taskId
      });
      
      if (state.data.historyId) {
        queryParams.append('historyId', state.data.historyId);
      }
      
      const response = await fetch(`/api/generate-video?${queryParams}`);
      const result = await response.json();

      if (result.success) {
        if (result.status === 'SUCCESS' && result.videoUrl) {
          updateData({
            video: {
              ...state.data.video,
              url: result.videoUrl,
              status: 'completed'
            }
          });
          
          updateStepResult('generate-video', {
            status: 'completed',
            data: { videoUrl: result.videoUrl },
            canView: true
          });

          // Move to complete step
          setState(prev => ({ ...prev, currentStep: 'complete', isLoading: false }));
          updateStepResult('complete', { status: 'completed', canView: true });
          
        } else if (result.status === 'FAILED') {
          updateData({
            video: {
              ...state.data.video,
              status: 'error'
            }
          });
          updateStepResult('generate-video', { status: 'error', error: result.error || 'Video generation failed' });
        }
      }
    } catch (error: any) {
      console.error('Failed to check video status:', error);
      updateStepResult('generate-video', { status: 'error', error: error.message });
    }
  }, [state.data.video, updateData, updateStepResult]);

  return {
    state,
    uploadFile,
    retryFromStep,
    checkCoverStatus,
    checkVideoStatus,
    updateStepResult
  };
};