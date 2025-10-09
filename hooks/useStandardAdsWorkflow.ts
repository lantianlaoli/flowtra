import { useState, useCallback, useEffect } from 'react';

export type WorkflowStep = 'describing' | 'generating_prompts' | 'generating_cover' | 'generating_video' | 'complete';
export type WorkflowStatus = 'started' | 'uploaded_waiting_config' | 'workflow_initiated' | 'in_progress' | 'completed' | 'failed';

export interface WorkflowState {
  isLoading: boolean;
  error: string | null;
  historyId: string | null;
  workflowStatus: WorkflowStatus;
  currentStep: WorkflowStep | null;
  progress: number;
  data: {
    uploadedFile?: {
      url: string;
      path?: string;
    };
    productDescription?: string;
    creativePrompts?: any;
    video?: {
      url: string;
    };
    errorMessage?: string;
    creditsUsed?: number;
    videoModel?: 'auto' | 'veo3' | 'veo3_fast' | 'sora2';
    watermark?: {
      enabled: boolean;
      text: string;
    };
  };
  
  // Guest usage tracking
  guestUsageCount: number;
  maxGuestUsage: number;
}

export const useStandardAdsWorkflow = (
  userId?: string | null,
  selectedModel: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' = 'veo3_fast',
  selectedImageModel: 'auto' | 'nano_banana' | 'seedream' = 'nano_banana',
  updateCredits?: (newCredits: number) => void,
  refetchCredits?: () => Promise<void>,
  elementsCount: number = 1,
  imageSize: string = 'auto',
  videoAspectRatio: '16:9' | '9:16' = '16:9',
  adCopy: string = ''
) => {
  // Initialize guest usage limits
  const maxGuestUsage = 1; // Guest users: 1 VEO3_fast
  const maxUserUsage = 2;   // Logged users: 2 VEO3_fast
  
  const [guestUsageCount, setGuestUsageCount] = useState(0);
  
  // Load guest usage from localStorage on mount
  useEffect(() => {
    if (!userId) {
      const saved = localStorage.getItem('flowtra_guest_usage');
      setGuestUsageCount(saved ? parseInt(saved) : 0);
    }
  }, [userId]);
  
  // Save guest usage to localStorage
  const updateGuestUsage = useCallback((count: number) => {
    setGuestUsageCount(count);
    localStorage.setItem('flowtra_guest_usage', count.toString());
  }, []);

  const [state, setState] = useState<WorkflowState>({
    isLoading: false,
    error: null,
    historyId: null,
    workflowStatus: 'started',
    currentStep: null,
    progress: 0,
    data: {
      videoModel: selectedModel
    },
    guestUsageCount,
    maxGuestUsage: userId ? maxUserUsage : maxGuestUsage
  });

  // Update video model when selectedModel changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      data: {
        ...prev.data,
        videoModel: selectedModel
      }
    }));
  }, [selectedModel]);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading, error: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, isLoading: false, error }));
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    if (!file) return;
    
    try {
      setLoading(true);
      
      // Check guest usage limits
      const currentMaxUsage = userId ? maxUserUsage : maxGuestUsage;
      const currentUsageCount = userId ? 0 : guestUsageCount; // For logged users, check from backend
      
      if (currentUsageCount >= currentMaxUsage) {
        const message = userId 
          ? `You have reached the limit of ${maxUserUsage} free generations. Please purchase credits to continue.`
          : `You have reached the guest limit of ${maxGuestUsage} free generation. Please sign up for more generations.`;
        setError(message);
        setLoading(false);
        return;
      }
      
      // Increment guest usage count when starting
      if (!userId) {
        updateGuestUsage(guestUsageCount + 1);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('videoModel', selectedModel);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        historyId: result.historyId,
        workflowStatus: result.workflowStarted ? 'workflow_initiated' : 'uploaded_waiting_config',
        data: {
          ...prev.data,
          uploadedFile: { url: result.fileUrl, path: result.path }
        }
      }));

      // Update credits immediately after successful workflow start
      if (result.workflowStarted && result.remainingCredits !== undefined && updateCredits && userId) {
        console.log(`🔄 Updating credits in sidebar: ${result.remainingCredits} remaining after using ${result.creditsUsed}`);
        updateCredits(result.remainingCredits);
      }

      // Start polling if we got a historyId (with delay to allow UI to show success state)
      if (result.historyId) {
        setTimeout(() => {
          pollWorkflowStatus(result.historyId);
        }, 1000); // Wait 1 second before starting to poll
      }

    } catch (error: any) {
      // Revert guest usage count on error
      if (!userId) {
        updateGuestUsage(Math.max(0, guestUsageCount - 1));
      }
      
      // Refetch credits in case of error (credits might have been refunded)
      if (userId && refetchCredits) {
        console.log('🔄 Refetching credits due to upload error');
        refetchCredits();
      }
      
      setError(error.message || 'Upload failed');
    }
  }, [userId, guestUsageCount, maxGuestUsage, updateGuestUsage, setLoading, setError, selectedModel]);

  const pollWorkflowStatus = useCallback((historyId: string) => {
    let pollInterval: NodeJS.Timeout;
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/standard-ads/${historyId}/status`);
        if (!response.ok) {
          console.error('Failed to fetch workflow status:', response.status);
          return;
        }
        
        const result = await response.json();
        if (!result.success) {
          console.error('Workflow status error:', result.error);
          return;
        }
        
        setState(prev => {
          // Don't override workflow_initiated status until user explicitly navigates away
          // This allows the success screen to stay visible until user clicks a button
          const shouldUpdateStatus = prev.workflowStatus !== 'workflow_initiated' || 
                                   result.workflowStatus === 'failed' || 
                                   result.workflowStatus === 'completed';
          
          // Update credits in sidebar when credits are used/refunded
          if (result.data.creditsUsed && updateCredits && userId && result.data.creditsRemaining !== undefined) {
            updateCredits(result.data.creditsRemaining);
          }
          
          return {
            ...prev,
            workflowStatus: shouldUpdateStatus ? result.workflowStatus : prev.workflowStatus,
            currentStep: result.currentStep,
            progress: result.progress,
            data: {
              ...prev.data,
              productDescription: result.data.productDescription,
              creativePrompts: result.data.creativePrompts,
              video: result.data.videoUrl ? {
                url: result.data.videoUrl
              } : undefined,
              errorMessage: result.data.errorMessage,
              creditsUsed: result.data.creditsUsed,
              videoModel: result.data.videoModel
            }
          };
        });
        
        // Stop polling if completed or failed
        if (result.isCompleted || result.isFailed) {
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          if (result.isFailed) {
            setError(result.data.errorMessage || 'Workflow failed');
            // Refetch credits in case of failure (credits might have been refunded)
            if (userId && refetchCredits) {
              console.log('🔄 Refetching credits due to workflow failure');
              refetchCredits();
            }
          }
        }
        
      } catch (error) {
        console.error('Error polling workflow status:', error);
      }
    };
    
    // Start immediate poll and then every 5 seconds
    poll();
    pollInterval = setInterval(poll, 5000);
    
    // Cleanup function
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [setError]);

  const resetWorkflow = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      historyId: null,
      workflowStatus: 'started',
      currentStep: null,
      progress: 0,
      data: {
        videoModel: selectedModel
      },
      guestUsageCount,
      maxGuestUsage: userId ? maxUserUsage : maxGuestUsage
    });
  }, [selectedModel, guestUsageCount, userId, maxUserUsage, maxGuestUsage]);

  const startWorkflowWithSelectedProduct = useCallback(async (
    selectedProductId: string,
    watermarkConfig: { enabled: boolean; text: string; location?: string },
    currentElementsCount?: number,
    currentImageSize?: string,
    generateVideo?: boolean,
    currentVideoAspectRatio?: '16:9' | '9:16'
  ) => {
    try {
      setLoading(true);

      const requestData = {
        selectedProductId,
        userId: userId,
        videoModel: selectedModel,
        imageModel: selectedImageModel,
        watermark: watermarkConfig.enabled ? {
          text: watermarkConfig.text,
          location: watermarkConfig.location || 'bottom left'
        } : undefined,
        elementsCount: currentElementsCount ?? elementsCount,
        imageSize: currentImageSize ?? imageSize,
        shouldGenerateVideo: generateVideo,
        videoAspectRatio: currentVideoAspectRatio ?? videoAspectRatio,
        adCopy: adCopy?.trim() ? adCopy.trim() : undefined
      };

      console.log('🔍 useWorkflow startWorkflowWithSelectedProduct requestData:', requestData);

      const response = await fetch('/api/standard-ads/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start workflow');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        historyId: result.historyId,
        workflowStatus: 'workflow_initiated',
        data: {
          ...prev.data,
          watermark: watermarkConfig
        }
      }));

      // Update credits immediately after successful workflow start
      if (result.remainingCredits !== undefined && updateCredits && userId) {
        console.log(`🔄 Updating credits in sidebar: ${result.remainingCredits} remaining after using ${result.creditsUsed}`);
        updateCredits(result.remainingCredits);
      }

      // Start polling if we got a historyId (with delay to allow UI to show success state)
      if (result.historyId) {
        setTimeout(() => {
          pollWorkflowStatus(result.historyId);
        }, 1000); // Wait 1 second before starting to poll
      }

    } catch (error: any) {
      // Refetch credits in case of error (credits might have been refunded)
      if (userId && refetchCredits) {
        console.log('🔄 Refetching credits due to workflow start error');
        refetchCredits();
      }

      setError(error.message || 'Failed to start workflow');
    }
  }, [userId, selectedModel, selectedImageModel, elementsCount, imageSize, videoAspectRatio, adCopy, setLoading, setError, updateCredits, refetchCredits, pollWorkflowStatus]);

  const startWorkflowWithConfig = useCallback(async (
    watermarkConfig: { enabled: boolean; text: string; location?: string },
    currentElementsCount?: number,
    currentImageSize?: string,
    generateVideo?: boolean,
    currentVideoAspectRatio?: '16:9' | '9:16'
  ) => {
    if (!state.data.uploadedFile?.url || !state.data.uploadedFile?.path) {
      setError('No uploaded file found');
      return;
    }

    try {
      setLoading(true);

      const requestData = {
        imageUrl: state.data.uploadedFile.url,
        imagePath: state.data.uploadedFile.path,
        userId: userId,
        videoModel: selectedModel,
        imageModel: selectedImageModel,
        watermark: watermarkConfig.enabled ? {
          text: watermarkConfig.text,
          location: watermarkConfig.location || 'bottom left'
        } : undefined,
        elementsCount: currentElementsCount ?? elementsCount,
        imageSize: currentImageSize ?? imageSize,
        shouldGenerateVideo: generateVideo,
        videoAspectRatio: currentVideoAspectRatio ?? videoAspectRatio,
        adCopy: adCopy?.trim() ? adCopy.trim() : undefined
      };

      console.log('🔍 useWorkflow startWorkflowWithConfig requestData:', requestData);

      const response = await fetch('/api/standard-ads/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start workflow');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        historyId: result.historyId,
        workflowStatus: 'workflow_initiated',
        data: {
          ...prev.data,
          watermark: watermarkConfig
        }
      }));

      // Update credits immediately after successful workflow start
      if (result.remainingCredits !== undefined && updateCredits && userId) {
        console.log(`🔄 Updating credits in sidebar: ${result.remainingCredits} remaining after using ${result.creditsUsed}`);
        updateCredits(result.remainingCredits);
      }

      // Start polling if we got a historyId (with delay to allow UI to show success state)
      if (result.historyId) {
        setTimeout(() => {
          pollWorkflowStatus(result.historyId);
        }, 1000); // Wait 1 second before starting to poll
      }

    } catch (error: any) {
      // Refetch credits in case of error (credits might have been refunded)
      if (userId && refetchCredits) {
        console.log('🔄 Refetching credits due to workflow start error');
        refetchCredits();
      }
      
      setError(error.message || 'Failed to start workflow');
    }
  }, [state.data.uploadedFile, userId, selectedModel, selectedImageModel, elementsCount, imageSize, videoAspectRatio, adCopy, setLoading, setError, updateCredits, refetchCredits, pollWorkflowStatus]);

  const startWorkflowWithTemporaryImages = useCallback(async (
    imageFiles: File[],
    watermarkConfig: { enabled: boolean; text: string; location?: string },
    currentElementsCount?: number,
    currentImageSize?: string,
    generateVideo?: boolean,
    currentVideoAspectRatio?: '16:9' | '9:16'
  ) => {
    try {
      setLoading(true);

      // Upload images to Supabase first
      const formData = new FormData();
      imageFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });

      const uploadResponse = await fetch('/api/upload-temp-images', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await uploadResponse.json();
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Failed to upload images');
      }

      const primaryImageUrl = uploadResult.imageUrls[0];

      // Start workflow with uploaded image URL
      const requestData = {
        imageUrl: primaryImageUrl,
        userId: userId,
        videoModel: selectedModel,
        imageModel: selectedImageModel,
        watermark: watermarkConfig.enabled ? {
          text: watermarkConfig.text,
          location: watermarkConfig.location || 'bottom left'
        } : undefined,
        elementsCount: currentElementsCount ?? elementsCount,
        imageSize: currentImageSize ?? imageSize,
        shouldGenerateVideo: generateVideo,
        videoAspectRatio: currentVideoAspectRatio ?? videoAspectRatio,
        adCopy: adCopy?.trim() ? adCopy.trim() : undefined
      };

      console.log('🔍 useWorkflow startWorkflowWithTemporaryImages requestData:', requestData);

      const response = await fetch('/api/standard-ads/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to start workflow');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        historyId: result.historyId,
        workflowStatus: 'workflow_initiated',
        data: {
          ...prev.data,
          uploadedFile: { url: primaryImageUrl },
          watermark: watermarkConfig
        }
      }));

      // Update credits immediately after successful workflow start
      if (result.remainingCredits !== undefined && updateCredits && userId) {
        console.log(`🔄 Updating credits in sidebar: ${result.remainingCredits} remaining after using ${result.creditsUsed}`);
        updateCredits(result.remainingCredits);
      }

      // Start polling if we got a historyId
      if (result.historyId) {
        setTimeout(() => {
          pollWorkflowStatus(result.historyId);
        }, 1000);
      }

    } catch (error: any) {
      // Refetch credits in case of error
      if (userId && refetchCredits) {
        console.log('🔄 Refetching credits due to workflow start error');
        refetchCredits();
      }

      setError(error.message || 'Failed to start workflow with temporary images');
    }
  }, [userId, selectedModel, selectedImageModel, elementsCount, imageSize, videoAspectRatio, adCopy, setLoading, setError, updateCredits, refetchCredits, pollWorkflowStatus]);

  return {
    state,
    uploadFile,
    startWorkflowWithConfig,
    startWorkflowWithSelectedProduct,
    startWorkflowWithTemporaryImages,
    resetWorkflow,
    pollWorkflowStatus
  };
};
