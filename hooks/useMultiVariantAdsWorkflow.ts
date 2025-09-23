import { useState, useEffect, useCallback } from 'react';
import { getCreditCost } from '@/lib/constants';

export interface WorkflowInstanceState {
  id: string;
  user_id: string;
  elements_data?: any;
  cover_task_id?: string;
  video_task_id?: string;
  cover_image_url?: string;
  cover_image_size?: string | null;
  video_url?: string;
  status: 'pending' | 'generating_cover' | 'generating_video' | 'completed' | 'failed';
  current_step: 'waiting' | 'generating_cover' | 'generating_video' | 'completed';
  credits_cost: number;
  downloaded: boolean;
  error_message?: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  last_processed_at: string;
}

interface WorkflowV2State {
  isLoading: boolean;
  error: string | null;
  uploadedFile: { file: File; url: string } | null;
  instances: WorkflowInstanceState[];
  workflowStatus: 'idle' | 'uploaded' | 'processing' | 'completed' | 'failed';
}

export function useMultiVariantAdsWorkflow(
  userId?: string,
  videoModel: 'veo3' | 'veo3_fast' = 'veo3_fast',
  imageModel: 'nano_banana' | 'seedream' = 'nano_banana',
  elementsCount: number = 2,
  adCopy: string = '',
  textWatermark: string = '',
  textWatermarkLocation: string = 'bottom left',
  imageSize: string = 'auto',
  shouldGenerateVideo: boolean = true
) {
  const [state, setState] = useState<WorkflowV2State>({
    isLoading: false,
    error: null,
    uploadedFile: null,
    instances: [],
    workflowStatus: 'idle'
  });
  const [currentItemIds, setCurrentItemIds] = useState<string[]>([]);

  // Upload file
  const uploadFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const result = await response.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        uploadedFile: { file, url: result.fileUrl || result.publicUrl },
        workflowStatus: 'uploaded'
      }));

      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }));
      throw error;
    }
  }, []);

  // Start V2 items (no DB batch)
  const startBatchWorkflow = useCallback(async () => {
    if (!state.uploadedFile || !userId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/multi-variant-ads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: state.uploadedFile.url,
          userId,
          videoModel,
          imageModel,
          elementsCount,
          adCopy,
          textWatermark,
          textWatermarkLocation,
          imageSize,
          generateVideo: shouldGenerateVideo
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start workflow');
      }

      const result = await response.json();
      const itemIds: string[] = result.itemIds || [];
      setCurrentItemIds(itemIds);
      const creditsCost = shouldGenerateVideo ? getCreditCost(videoModel) : 0;

      const seeded = itemIds.map((id) => ({
        id,
        user_id: userId,
        elements_data: { generate_video: shouldGenerateVideo },
        cover_image_size: imageSize,
        status: 'pending' as const,
        current_step: 'waiting' as const,
        credits_cost: creditsCost,
        downloaded: false,
        progress_percentage: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_processed_at: new Date().toISOString()
      } as WorkflowInstanceState));
      setState(prev => ({ ...prev, instances: seeded }));
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        workflowStatus: 'processing'
      }));

      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to start workflow'
      }));
      throw error;
    }
  }, [state.uploadedFile, userId, videoModel, elementsCount, adCopy, textWatermark, textWatermarkLocation, imageSize, shouldGenerateVideo]);

  // Download content
  const downloadContent = useCallback(async (instanceId: string, contentType: 'cover' | 'video') => {
    try {
      const response = await fetch(`/api/multi-variant-ads/${instanceId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download content');
      }

      const result = await response.json();
      
      if (result.success && result.downloadUrl) {
        // Trigger download
        const link = document.createElement('a');
        link.href = result.downloadUrl;
        link.download = `${contentType}-${instanceId}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Update local state if it was a video download (paid content)
        if (contentType === 'video' && result.creditsUsed > 0) {
          setState(prev => ({
            ...prev,
            instances: prev.instances.map(instance => 
              instance.id === instanceId 
                ? { ...instance, downloaded: true }
                : instance
            )
          }));
        }
      }

      return result;
    } catch (error) {
      throw error;
    }
  }, []);

  // Reset workflow
  const resetWorkflow = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      uploadedFile: null,
      instances: [],
      workflowStatus: 'idle'
    });
    setCurrentItemIds([]);
  }, []);

  // Fetch items status
  const fetchItemsStatus = useCallback(async (ids: string[]) => {
    try {
      if (!ids.length) return null;
      const response = await fetch(`/api/multi-variant-ads/items-status?ids=${encodeURIComponent(ids.join(','))}`);
      if (!response.ok) throw new Error('Failed to fetch items status');
      const result = await response.json();
      if (result.success) {
        const instances: WorkflowInstanceState[] = (result.items || []).map((it: any) => ({
          id: it.id,
          user_id: it.user_id,
          elements_data: it.elements_data,
          cover_task_id: it.cover_task_id,
          video_task_id: it.video_task_id,
          cover_image_url: it.cover_image_url,
          cover_image_size: it.cover_image_size,
          video_url: it.video_url,
          status: it.status,
          current_step: it.current_step,
          credits_cost: it.credits_cost,
          downloaded: it.downloaded,
          error_message: it.error_message,
          progress_percentage: it.progress_percentage,
          created_at: it.created_at,
          updated_at: it.updated_at,
          last_processed_at: it.last_processed_at
        }));
        const allCompleted = instances.length > 0 && instances.every(i => i.status === 'completed');
        const anyFailed = instances.some(i => i.status === 'failed');
        setState(prev => ({
          ...prev,
          instances,
          workflowStatus: anyFailed ? 'failed' : (allCompleted ? 'completed' : 'processing')
        }));
      }
      return result;
    } catch (error) {
      console.error('Failed to fetch items status:', error);
      return null;
    }
  }, []);

  // Auto-fetch items status
  useEffect(() => {
    if (!currentItemIds.length) return;
    const interval = setInterval(() => {
      if (state.workflowStatus === 'processing') {
        fetchItemsStatus(currentItemIds);
      }
    }, 3000);
    fetchItemsStatus(currentItemIds);
    return () => clearInterval(interval);
  }, [currentItemIds, state.workflowStatus, fetchItemsStatus]);

  return {
    state,
    uploadFile,
    startBatchWorkflow,
    downloadContent,
    resetWorkflow,
    fetchBatchStatus: async () => null
  };
}

// Cost is determined centrally in constants
