import { useState, useCallback, useEffect } from 'react';

export type WorkflowStep = 'describing' | 'generating_prompts' | 'generating_cover' | 'generating_video' | 'complete';
export type WorkflowStatus = 'started' | 'workflow_initiated' | 'in_progress' | 'completed' | 'failed';

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
      // Check KIE API credits first
      setLoading(true);
      
      console.log('🔍 Checking KIE credits...');
      const creditsResponse = await fetch('/api/check-kie-credits');
      const creditsResult = await creditsResponse.json();
      
      console.log('📊 KIE Credits Result:', creditsResult);
      
      if (!creditsResult.success || !creditsResult.sufficient) {
        console.log('❌ KIE Credits insufficient, showing maintenance message');
        setLoading(false);
        setError('Service temporarily under maintenance, please try again later. Contact support for urgent needs.');
        return;
      }
      
      console.log('✅ KIE Credits sufficient, proceeding with upload');
      
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
        workflowStatus: result.workflowStarted ? 'workflow_initiated' : 'started',
        data: {
          ...prev.data,
          uploadedFile: { url: result.fileUrl, path: result.path }
        }
      }));

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
        
        setState(prev => {
          // Don't override workflow_initiated status until user explicitly navigates away
          // This allows the success screen to stay visible until user clicks a button
          const shouldUpdateStatus = prev.workflowStatus !== 'workflow_initiated' || 
                                   result.workflowStatus === 'failed' || 
                                   result.workflowStatus === 'completed';
          
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