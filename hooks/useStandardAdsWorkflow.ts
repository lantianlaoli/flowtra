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
  workflowInitiatedCount: number; // Counter that increments each time workflow is initiated
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
    videoModel?: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro';
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
  selectedModel: 'auto' | 'veo3' | 'veo3_fast' | 'sora2' | 'sora2_pro' = 'veo3_fast',
  selectedImageModel: 'auto' | 'nano_banana' | 'seedream' = 'nano_banana',
  updateCredits?: (newCredits: number) => void,
  refetchCredits?: () => Promise<void>,
  elementsCount: number = 1,
  imageSize: string = 'auto',
  videoAspectRatio: '16:9' | '9:16' = '16:9',
  videoQuality: 'standard' | 'high' = 'standard',
  videoDuration: '8' | '10' | '15' = '8',
  adCopy: string = '',
  selectedLanguage: string = 'en',
  useCustomScript: boolean = false,
  customScript: string = ''
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
    workflowInitiatedCount: 0,
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

  const resolveVideoConfig = useCallback(() => {
    const normalizedDuration = videoDuration === '15'
      ? '15'
      : videoDuration === '10'
        ? '10'
        : '8';

    return { videoDuration: normalizedDuration, videoQuality } as const;
  }, [videoDuration, videoQuality]);

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

      const normalizedHistoryId = result.historyId || result.projectId || null;

      setState(prev => ({
        ...prev,
        isLoading: false,
        historyId: normalizedHistoryId,
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

      // No polling - workflow runs completely in background via monitor-tasks

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

  // Polling removed - workflow runs completely in background via monitor-tasks API

  const resetWorkflow = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      historyId: null,
      workflowStatus: 'started',
      currentStep: null,
      progress: 0,
      workflowInitiatedCount: 0,
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
    selectedBrandId?: string
  ) => {
    const previousStatus = state.workflowStatus;

    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        workflowStatus:
          prev.workflowStatus === 'started' || prev.workflowStatus === 'uploaded_waiting_config'
            ? 'workflow_initiated'
            : prev.workflowStatus
      }));

      const { videoDuration: resolvedDuration, videoQuality: resolvedQuality } = resolveVideoConfig();
      const sora2ProDuration = selectedModel === 'sora2_pro' && resolvedDuration
        ? (resolvedDuration === '15' ? '15' : '10')
        : undefined;

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
        videoAspectRatio: videoAspectRatio,
        videoDuration: resolvedDuration,
        videoQuality: resolvedQuality,
        sora2ProDuration,
        sora2ProQuality: selectedModel === 'sora2_pro' ? resolvedQuality : undefined,
        adCopy: adCopy?.trim() ? adCopy.trim() : undefined,
        selectedBrandId: selectedBrandId,
        language: selectedLanguage,
        useCustomScript: useCustomScript,
        customScript: customScript?.trim() ? customScript.trim() : undefined
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

      const normalizedHistoryId = result.historyId || result.projectId || null;

      setState(prev => ({
        ...prev,
        isLoading: false,
        historyId: normalizedHistoryId,
        workflowStatus: 'workflow_initiated',
        workflowInitiatedCount: prev.workflowInitiatedCount + 1,
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

      // No polling - workflow runs completely in background via monitor-tasks
      return { ...result, historyId: normalizedHistoryId };

    } catch (error: any) {
      // Refetch credits in case of error (credits might have been refunded)
      if (userId && refetchCredits) {
        console.log('🔄 Refetching credits due to workflow start error');
        refetchCredits();
      }

      const message = error instanceof Error ? error.message : 'Failed to start workflow';
      setState(prev => ({
        ...prev,
        isLoading: false,
        workflowStatus: previousStatus,
        error: message
      }));
    }
  }, [
    userId,
    selectedModel,
    selectedImageModel,
    elementsCount,
    imageSize,
    videoAspectRatio,
    resolveVideoConfig,
    adCopy,
    selectedLanguage,
    useCustomScript,
    customScript,
    updateCredits,
    refetchCredits,
    state.workflowStatus
  ]);

  const startWorkflowWithConfig = useCallback(async (
    watermarkConfig: { enabled: boolean; text: string; location?: string },
    currentElementsCount?: number,
    currentImageSize?: string,
    generateVideo?: boolean,
    selectedBrandId?: string
  ) => {
    if (!state.data.uploadedFile?.url || !state.data.uploadedFile?.path) {
      setError('No uploaded file found');
      return;
    }

    const previousStatus = state.workflowStatus;

    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        workflowStatus:
          prev.workflowStatus === 'started' || prev.workflowStatus === 'uploaded_waiting_config'
            ? 'workflow_initiated'
            : prev.workflowStatus
      }));

      const { videoDuration: resolvedDuration, videoQuality: resolvedQuality } = resolveVideoConfig();
      const sora2ProDuration = selectedModel === 'sora2_pro' && resolvedDuration
        ? (resolvedDuration === '15' ? '15' : '10')
        : undefined;

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
        videoAspectRatio: videoAspectRatio,
        videoDuration: resolvedDuration,
        videoQuality: resolvedQuality,
        sora2ProDuration,
        sora2ProQuality: selectedModel === 'sora2_pro' ? resolvedQuality : undefined,
        adCopy: adCopy?.trim() ? adCopy.trim() : undefined,
        selectedBrandId: selectedBrandId,
        language: selectedLanguage,
        useCustomScript: useCustomScript,
        customScript: customScript?.trim() ? customScript.trim() : undefined
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

      const normalizedHistoryId = result.historyId || result.projectId || null;

      setState(prev => ({
        ...prev,
        isLoading: false,
        historyId: normalizedHistoryId,
        workflowStatus: 'workflow_initiated',
        workflowInitiatedCount: prev.workflowInitiatedCount + 1,
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

      // No polling - workflow runs completely in background via monitor-tasks
      return { ...result, historyId: normalizedHistoryId };

    } catch (error: any) {
      // Refetch credits in case of error (credits might have been refunded)
      if (userId && refetchCredits) {
        console.log('🔄 Refetching credits due to workflow start error');
        refetchCredits();
      }
      
      const message = error instanceof Error ? error.message : 'Failed to start workflow';
      setState(prev => ({
        ...prev,
        isLoading: false,
        workflowStatus: previousStatus,
        error: message
      }));
    }
  }, [
    state.data.uploadedFile,
    userId,
    selectedModel,
    selectedImageModel,
    elementsCount,
    imageSize,
    videoAspectRatio,
    resolveVideoConfig,
    adCopy,
    selectedLanguage,
    useCustomScript,
    customScript,
    updateCredits,
    refetchCredits,
    state.workflowStatus
  ]);

  const startWorkflowWithTemporaryImages = useCallback(async (
    imageFiles: File[],
    watermarkConfig: { enabled: boolean; text: string; location?: string },
    currentElementsCount?: number,
    currentImageSize?: string,
    generateVideo?: boolean,
    selectedBrandId?: string
  ) => {
    const previousStatus = state.workflowStatus;

    try {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        workflowStatus:
          prev.workflowStatus === 'started' || prev.workflowStatus === 'uploaded_waiting_config'
            ? 'workflow_initiated'
            : prev.workflowStatus
      }));

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
      const { videoDuration: resolvedDuration, videoQuality: resolvedQuality } = resolveVideoConfig();
      const sora2ProDuration = selectedModel === 'sora2_pro' && resolvedDuration
        ? (resolvedDuration === '15' ? '15' : '10')
        : undefined;

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
        videoAspectRatio: videoAspectRatio,
        videoDuration: resolvedDuration,
        videoQuality: resolvedQuality,
        sora2ProDuration,
        sora2ProQuality: selectedModel === 'sora2_pro' ? resolvedQuality : undefined,
        adCopy: adCopy?.trim() ? adCopy.trim() : undefined,
        selectedBrandId: selectedBrandId,
        language: selectedLanguage,
        useCustomScript: useCustomScript,
        customScript: customScript?.trim() ? customScript.trim() : undefined
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

      const normalizedHistoryId = result.historyId || result.projectId || null;

      setState(prev => ({
        ...prev,
        isLoading: false,
        historyId: normalizedHistoryId,
        workflowStatus: 'workflow_initiated',
        workflowInitiatedCount: prev.workflowInitiatedCount + 1,
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

      // No polling - workflow runs completely in background via monitor-tasks

    } catch (error: any) {
      // Refetch credits in case of error
      if (userId && refetchCredits) {
        console.log('🔄 Refetching credits due to workflow start error');
        refetchCredits();
      }

      const message = error instanceof Error ? error.message : 'Failed to start workflow with temporary images';
      setState(prev => ({
        ...prev,
        isLoading: false,
        workflowStatus: previousStatus,
        error: message
      }));
    }
  }, [
    userId,
    selectedModel,
    selectedImageModel,
    elementsCount,
    imageSize,
    videoAspectRatio,
    resolveVideoConfig,
    adCopy,
    selectedLanguage,
    useCustomScript,
    customScript,
    updateCredits,
    refetchCredits,
    state.workflowStatus
  ]);

  return {
    state,
    uploadFile,
    startWorkflowWithConfig,
    startWorkflowWithSelectedProduct,
    startWorkflowWithTemporaryImages,
    resetWorkflow
  };
};
