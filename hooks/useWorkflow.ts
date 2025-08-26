import { useState, useCallback, useEffect } from 'react';

export type WorkflowStep = 'describing' | 'generating_prompts' | 'generating_cover' | 'generating_video' | 'complete';
export type WorkflowStatus = 'started' | 'in_progress' | 'completed' | 'failed';

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
    videoModel?: 'auto' | 'veo3' | 'veo3_fast';
  };
  
  // Guest usage tracking
  guestUsageCount: number;
  maxGuestUsage: number;
}

export const useWorkflow = (userId?: string | null, selectedModel: 'auto' | 'veo3' | 'veo3_fast' = 'auto') => {
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

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading, error: null }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, isLoading: false, error }));
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    if (!file) return;
    
    try {
      // Check guest usage limits
      const currentMaxUsage = userId ? maxUserUsage : maxGuestUsage;
      const currentUsageCount = userId ? 0 : guestUsageCount; // For logged users, check from backend
      
      if (currentUsageCount >= currentMaxUsage) {
        const message = userId 
          ? `You have reached the limit of ${maxUserUsage} free generations. Please purchase credits to continue.`
          : `You have reached the guest limit of ${maxGuestUsage} free generation. Please sign up for more generations.`;
        setError(message);
        return;
      }
      
      setLoading(true);
      
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
        workflowStatus: 'started',
        data: {
          ...prev.data,
          uploadedFile: { url: result.fileUrl, path: result.path }
        }
      }));

      // Start polling if we got a historyId
      if (result.historyId) {
        pollWorkflowStatus(result.historyId);
      }

    } catch (error: any) {
      // Revert guest usage count on error
      if (!userId) {
        updateGuestUsage(Math.max(0, guestUsageCount - 1));
      }
      setError(error.message || 'Upload failed');
    }
  }, [userId, guestUsageCount, maxGuestUsage, updateGuestUsage, setLoading, setError, selectedModel]);

  const pollWorkflowStatus = useCallback((historyId: string) => {
    let pollInterval: NodeJS.Timeout;
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/workflow-status?historyId=${historyId}`);
        if (!response.ok) {
          console.error('Failed to fetch workflow status:', response.status);
          return;
        }
        
        const result = await response.json();
        if (!result.success) {
          console.error('Workflow status error:', result.error);
          return;
        }
        
        setState(prev => ({
          ...prev,
          workflowStatus: result.workflowStatus,
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
        }));
        
        // Stop polling if completed or failed
        if (result.isCompleted || result.isFailed) {
          if (pollInterval) {
            clearInterval(pollInterval);
          }
          if (result.isFailed) {
            setError(result.data.errorMessage || 'Workflow failed');
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

  return {
    state,
    uploadFile,
    resetWorkflow,
    pollWorkflowStatus
  };
};