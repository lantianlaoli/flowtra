import { useState, useCallback, useEffect } from 'react';
import { snapDurationToModel, type VideoDuration, type VideoModel } from '@/lib/constants';

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
    creativePrompts?: any;
    video?: {
      url: string;
    };
    errorMessage?: string;
    creditsUsed?: number;
    videoModel?: VideoModel;
    watermark?: {
      enabled: boolean;
      text: string;
    };
  };

  // Guest usage tracking
  guestUsageCount: number;
  maxGuestUsage: number;
}

export const useCompetitorUgcReplicationWorkflow = (
  userId?: string | null,
  selectedModel: VideoModel = 'veo3_fast',
  selectedImageModel: 'auto' | 'nano_banana' | 'seedream' | 'nano_banana_pro' = 'nano_banana',
  updateCredits?: (newCredits: number) => void,
  refetchCredits?: () => Promise<void>,
  elementsCount: number = 1,
  imageSize: string = 'auto',
  videoAspectRatio: '16:9' | '9:16' = '16:9',
  videoDuration: VideoDuration = '8',
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
    let normalizedDuration: VideoDuration = videoDuration;

    // All supported models use 8-64 second range
    const allowed: VideoDuration[] = ['8', '16', '24', '32', '40', '48', '56', '64'];
    if (!allowed.includes(normalizedDuration)) {
      normalizedDuration = '8';
    }

    return { videoDuration: normalizedDuration } as const;
  }, [videoDuration, selectedModel]);

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
  }, [userId, guestUsageCount, maxGuestUsage, updateGuestUsage, setLoading, setError, selectedModel, refetchCredits, updateCredits]);

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

  const startWorkflowWithSelectedProduct = useCallback(async ({
    elementsCountOverride,
    imageSizeOverride,
    generateVideo = true,
    selectedBrandId,
    competitorAdId,
    replicaOptions
  }: {
    elementsCountOverride?: number;
    imageSizeOverride?: string;
    generateVideo?: boolean;
    selectedBrandId: string;
    competitorAdId: string;
    replicaOptions?: {
      photoOnly?: boolean;
      replicaMode?: boolean;
      referenceImageUrls?: string[];
      photoAspectRatio?: string;
      photoResolution?: '1K' | '2K' | '4K';
      photoOutputFormat?: 'png' | 'jpg';
    };
  }) => {
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

      const { videoDuration: resolvedDuration } = resolveVideoConfig();
      const normalizedPhotoOnly = typeof replicaOptions?.photoOnly === 'boolean'
        ? replicaOptions.photoOnly
        : generateVideo === undefined
          ? false
          : !generateVideo;

      const requestData = {
        userId: userId,
        videoModel: selectedModel,
        imageModel: selectedImageModel,
        elementsCount: elementsCountOverride ?? elementsCount,
        imageSize: imageSizeOverride ?? imageSize,
        shouldGenerateVideo: generateVideo,
        photoOnly: normalizedPhotoOnly,
        videoAspectRatio: videoAspectRatio,
        videoDuration: resolvedDuration,
        selectedBrandId: selectedBrandId,
        competitorAdId: competitorAdId || undefined, // Add competitor ad ID
        language: selectedLanguage,
        useCustomScript: useCustomScript,
        customScript: customScript?.trim() ? customScript.trim() : undefined,
        referenceImageUrls: replicaOptions?.referenceImageUrls,
        photoAspectRatio: replicaOptions?.photoAspectRatio,
        photoResolution: replicaOptions?.photoResolution,
        photoOutputFormat: replicaOptions?.photoOutputFormat,
        replicaMode: replicaOptions?.replicaMode
      };

      console.log('🔍 useWorkflow startWorkflowWithSelectedProduct requestData:', requestData);

      const response = await fetch('/api/competitor-ugc-replication/create', {
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
        data: prev.data
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
    startWorkflowWithSelectedProduct,
    resetWorkflow
  };
};
