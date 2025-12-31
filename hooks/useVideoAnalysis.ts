import { useState, useCallback } from 'react';
import { uploadFileToSupabase } from '@/lib/upload-to-supabase';
import { setFreeAnalysisUsed } from '@/lib/rate-limit';

export type AnalysisState =
  | 'initial'
  | 'idle'
  | 'uploading'
  | 'analyzing'
  | 'completed'
  | 'rate_limited'
  | 'error_duration'
  | 'error_upload'
  | 'error_analysis';

export interface CompetitorShot {
  shot_id: number;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  first_frame_description: string;
  subject: string;
  context_environment: string;
  action: string;
  style: string;
  camera_motion_positioning: string;
  composition: string;
  ambiance_colour_lighting: string;
  audio: string;
  contains_brand: boolean;
  contains_product: boolean;
}

export interface CompetitorAnalysis {
  name: string;
  detected_language: string;
  video_duration_seconds: number;
  shots: CompetitorShot[];
}

export interface VideoAnalysisResult {
  analysis: CompetitorAnalysis;
  language: string;
  videoUrl?: string;
}

export interface UseVideoAnalysisReturn {
  state: AnalysisState;
  uploadProgress: number;
  analysisProgress: number;
  result: VideoAnalysisResult | null;
  error: string | null;
  uploadedFile: File | null;
  uploadedVideoUrl: string | null;
  uploadVideo: (file: File) => Promise<void>;
  reset: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

/**
 * Custom hook for handling video upload and analysis
 */
export function useVideoAnalysis(): UseVideoAnalysisReturn {
  const [state, setState] = useState<AnalysisState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);

  /**
   * Simulate fake progress for analysis (0-90% over 30 seconds)
   */
  const startFakeProgress = useCallback(() => {
    const intervalId = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) {
          clearInterval(intervalId);
          return 90;
        }
        // Increase by 3% every second
        return prev + 3;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  /**
   * Upload video and trigger analysis
   */
  const uploadVideo = useCallback(
    async (file: File) => {
      try {
        // Reset state
        setError(null);
        setResult(null);
        setUploadProgress(0);
        setAnalysisProgress(0);
        setUploadedFile(file);

        // Validate file type
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setState('error_upload');
          setError('Invalid file type. Please upload MP4, MOV, or WEBM video.');
          return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          setState('error_upload');
          setError(
            `File size exceeds 50MB limit. Please compress your video first.`
          );
          return;
        }

        // Start upload
        setState('uploading');

        const path = `showcase_${Date.now()}_${file.name}`;
        console.log('[useVideoAnalysis] Uploading video:', path);

        // Upload to Supabase Storage
        const { publicUrl } = await uploadFileToSupabase(
          file,
          'competitor_videos',
          path
        );

        console.log('[useVideoAnalysis] Upload complete:', publicUrl);
        setUploadProgress(100);
        setUploadedVideoUrl(publicUrl);

        // Start analysis
        setState('analyzing');
        const clearFakeProgress = startFakeProgress();

        try {
          console.log('[useVideoAnalysis] Starting analysis...');

          const response = await fetch('/api/competitor-ads/analyze-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_url: publicUrl,
              uploaded_path: path,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();

            // Check for duration error
            if (
              errorData.details?.includes('80') ||
              errorData.details?.includes('duration')
            ) {
              clearFakeProgress();
              setState('error_duration');
              setError(
                errorData.details || 'Video exceeds maximum duration of 80 seconds.'
              );
              return;
            }

            throw new Error(errorData.details || 'Analysis failed');
          }

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || 'Analysis failed');
          }

          console.log('[useVideoAnalysis] Analysis complete');

          // Clear fake progress and set to 100%
          clearFakeProgress();
          setAnalysisProgress(100);

          // Save result
          setResult({
            analysis: data.analysis,
            language: data.language,
            videoUrl: publicUrl,
          });

          // Mark free analysis as used
          setFreeAnalysisUsed();

          setState('completed');
        } catch (analysisError) {
          clearFakeProgress();
          console.error('[useVideoAnalysis] Analysis error:', analysisError);
          setState('error_analysis');
          setError(
            analysisError instanceof Error
              ? analysisError.message
              : 'Analysis failed. Please try again.'
          );
        }
      } catch (uploadError) {
        console.error('[useVideoAnalysis] Upload error:', uploadError);
        setState('error_upload');
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : 'Upload failed. Please try again.'
        );
      }
    },
    [startFakeProgress]
  );

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setState('idle');
    setUploadProgress(0);
    setAnalysisProgress(0);
    setResult(null);
    setError(null);
    setUploadedFile(null);
    setUploadedVideoUrl(null);
  }, []);

  return {
    state,
    uploadProgress,
    analysisProgress,
    result,
    error,
    uploadedFile,
    uploadedVideoUrl,
    uploadVideo,
    reset,
  };
}
