'use client';

import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { AlertTriangle, XCircle, PartyPopper, Upload, Play, Mic, CheckCircle, ArrowRight, Mail } from 'lucide-react';
import { useVideoAnalysis } from '@/hooks/useVideoAnalysis';
import { hasUsedFreeAnalysis } from '@/lib/rate-limit';
import { BOOKING_URL } from '@/lib/booking';
import { useEffect, useState } from 'react';

// Inline refined components for left-right layout
function UploadZoneRefined({ onFileSelect, disabled = false }: { onFileSelect: (file: File) => void; disabled?: boolean }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && files[0].type.startsWith('video/')) {
      onFileSelect(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={handleDrop}
      className={`relative group transition-all duration-300 ${
        isDragging ? 'scale-[1.01]' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        onChange={handleFileInput}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        aria-label="Upload video file"
      />

      {/* Grid background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
        <div className="w-full h-full" style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
      </div>

      {/* Main upload area */}
      <div className={`relative border-2 transition-all duration-300 ${
        isDragging
          ? 'border-black bg-gray-50 shadow-[0_0_0_4px_rgba(0,0,0,0.05)]'
          : 'border-dashed border-gray-300 bg-white hover:border-black hover:bg-gray-50'
      }`}
        style={{ minHeight: '400px' }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center pointer-events-none">
          {/* Upload icon */}
          <div className={`w-20 h-20 mb-8 rounded-full bg-black flex items-center justify-center transition-transform duration-500 ${
            isDragging ? 'scale-110 rotate-12' : 'group-hover:scale-105'
          }`}>
            <Upload className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h3 className="text-3xl font-bold text-black mb-3 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
            Drop Video Here
          </h3>

          {/* Subtitle */}
          <p className="text-gray-600 mb-8 text-base max-w-sm leading-relaxed">
            Click to browse or drag and drop your viral video
          </p>

          {/* Specs */}
          <div className="flex flex-col gap-2 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              <span>Maximum 80 seconds</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              <span>MP4, MOV, WEBM formats</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="font-medium">1 free analysis per session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadingState({ fileName, fileSize, progress }: { fileName?: string; fileSize?: number; progress: number }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center">
          <Upload className="w-8 h-8 text-white animate-pulse" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-black tracking-tight mb-1" style={{ letterSpacing: '-0.02em' }}>
            Uploading
          </h3>
          <p className="text-gray-600 text-sm">{fileName}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">{fileSize ? `${(fileSize / 1024 / 1024).toFixed(1)} MB` : ''}</span>
          <span className="font-bold text-black">{progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-black transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function AnalyzingState({ progress }: { progress: number }) {
  const tips = [
    'Analyzing shot composition',
    'Detecting camera movements',
    'Extracting audio patterns',
    'Identifying brand elements',
    'Mapping narrative structure',
    'Breaking down visual style',
  ];

  const [currentTip, setCurrentTip] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % tips.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-12">
      {/* Animated geometric loader */}
      <div className="flex justify-center">
        <div className="relative w-24 h-24">
          {/* Rotating square */}
          <div
            className="absolute inset-0 border-4 border-black"
            style={{
              animation: 'spin 3s linear infinite',
            }}
          />
          {/* Inner rotating square */}
          <div
            className="absolute inset-4 border-4 border-gray-300"
            style={{
              animation: 'spin 2s linear infinite reverse',
            }}
          />
        </div>
      </div>

      <div className="text-center space-y-4">
        <h3 className="text-2xl font-bold text-black tracking-tight" style={{ letterSpacing: '-0.02em' }}>
          AI Analysis in Progress
        </h3>

        {/* Rotating tips */}
        <div className="h-6 overflow-hidden">
          <div
            className="transition-transform duration-500"
            style={{ transform: `translateY(-${currentTip * 24}px)` }}
          >
            {tips.map((tip, i) => (
              <p key={i} className="text-gray-600 text-sm h-6">
                {tip}...
              </p>
            ))}
          </div>
        </div>

        {/* Progress */}
        <div className="pt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Analyzing</span>
            <span className="font-medium text-black">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function VideoAnalysisUploader({ initialFile }: { initialFile?: File | null }) {
  const { isSignedIn } = useUser();
  const {
    state,
    uploadProgress,
    analysisProgress,
    result,
    error,
    uploadedFile,
    uploadedVideoUrl,
    uploadVideo,
    reset,
  } = useVideoAnalysis();

  const [isRateLimited, setIsRateLimited] = useState(false);

  useEffect(() => {
    if (isSignedIn) {
      setIsRateLimited(hasUsedFreeAnalysis());
    }
  }, [isSignedIn]);

  // Auto-upload when initialFile is provided
  useEffect(() => {
    if (initialFile && state === 'idle' && !isRateLimited) {
      handleFileSelect(initialFile);
    }
  }, [initialFile]);

  const handleFileSelect = (file: File) => {
    if (hasUsedFreeAnalysis()) {
      setIsRateLimited(true);
      return;
    }
    uploadVideo(file);
  };

  // LEFT-RIGHT LAYOUT WRAPPER
  const hasVideo = uploadedVideoUrl && (state === 'uploading' || state === 'analyzing' || state === 'completed');

  

  // FULL-WIDTH STATES (no video preview)
  // Rate Limited State
  if (isRateLimited || state === 'rate_limited') {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="space-y-6 text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black mx-auto">
            <PartyPopper className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-3xl font-bold text-black mb-3 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Free Analysis Used
            </h3>
            <p className="text-gray-600 mb-8">
              Want to analyze more videos? Sign up for unlimited analyses and start cloning viral ads.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center px-6 py-3 bg-black text-white font-medium hover:bg-gray-900 transition-colors"
              style={{ borderRadius: '8px' }}
            >
              View Pricing
            </Link>
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-black text-black font-medium hover:bg-gray-50 transition-colors"
              style={{ borderRadius: '8px' }}
            >
              <Mail className="w-4 h-4" strokeWidth={1.5} />
              Book a Demo
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Starting at $29/month
          </p>
        </div>
      </div>
    );
  }

  // Error - Duration Exceeded
  if (state === 'error_duration') {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="space-y-6 text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black mx-auto">
            <AlertTriangle className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-3xl font-bold text-black mb-3 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Video Too Long
            </h3>
            <p className="text-gray-600 mb-8">
              {error || 'Video duration must not exceed 1 minute 20 seconds (80 seconds). Please trim your video before uploading.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center px-6 py-3 bg-black text-white font-medium hover:bg-gray-900 transition-colors"
              style={{ borderRadius: '8px' }}
            >
              Try Another Video
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error - Upload/Analysis Failed
  if (state === 'error_upload' || state === 'error_analysis') {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="space-y-6 text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black mx-auto">
            <XCircle className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-3xl font-bold text-black mb-3 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              {state === 'error_upload' ? 'Upload Failed' : 'Analysis Failed'}
            </h3>
            <p className="text-gray-600 mb-8">
              {error || 'Something went wrong. Please try again.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center px-6 py-3 bg-black text-white font-medium hover:bg-gray-900 transition-colors"
              style={{ borderRadius: '8px' }}
            >
              Try Again
            </button>
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_EMAIL || 'hello@flowtra.com'}?subject=Analysis Error&body=${encodeURIComponent(`Error: ${error}`)}`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white border-2 border-black text-black font-medium hover:bg-gray-50 transition-colors"
              style={{ borderRadius: '8px' }}
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid gap-8 ${hasVideo ? 'lg:grid-cols-[1fr_400px]' : 'grid-cols-1'}`}>
      {/* LEFT COLUMN - Content */}
      <div className="min-h-[400px] flex flex-col justify-center">
        {/* Uploading */}
        {state === 'uploading' && (
          <UploadingState
            fileName={uploadedFile?.name}
            fileSize={uploadedFile?.size}
            progress={uploadProgress}
          />
        )}

        {/* Analyzing */}
        {state === 'analyzing' && (
          <AnalyzingState progress={analysisProgress} />
        )}

        {/* Completed - Results */}
        {state === 'completed' && result && (
          <div className="space-y-8">
            {/* Success header */}
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-black" strokeWidth={1.5} />
              <h3 className="text-3xl font-bold text-black tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Analysis Complete
              </h3>
            </div>

            {/* Metrics */}
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-2 bg-white border border-gray-300 font-medium text-sm">
                {result.analysis.shots.length} shots
              </div>
              <div className="px-4 py-2 bg-white border border-gray-300 font-medium text-sm">
                {result.analysis.video_duration_seconds}s duration
              </div>
              <div className="px-4 py-2 bg-white border border-gray-300 font-medium text-sm">
                {result.language.toUpperCase()}
              </div>
            </div>

            {/* Shot breakdown (first 3) */}
            <div className="space-y-3">
              {result.analysis.shots.slice(0, 3).map((shot) => (
                <div key={shot.shot_id} className="border border-gray-200 p-4 hover:border-black transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-xs font-bold text-black bg-gray-100 px-2 py-1">
                      SHOT {shot.shot_id}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">
                      {shot.start_time} - {shot.end_time}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <Play className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                      <p className="text-gray-800">{shot.action}</p>
                    </div>
                    {shot.audio && (
                      <div className="flex items-start gap-2">
                        <Mic className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                        <p className="text-gray-600 italic">&quot;{shot.audio}&quot;</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {result.analysis.shots.length > 3 && (
                <p className="text-center text-sm text-gray-500 py-2">
                  +{result.analysis.shots.length - 3} more {result.analysis.shots.length - 3 === 1 ? 'shot' : 'shots'}
                </p>
              )}
            </div>

            {/* CTA */}
            <div className="pt-6 border-t border-gray-200 space-y-4">
              <Link
                href="/dashboard/competitor-ugc-replication"
                onClick={() => {
                  if (result) {
                    sessionStorage.setItem('showcase_analysis', JSON.stringify(result));
                  }
                }}
                className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-black text-white font-medium hover:bg-gray-900 transition-colors"
                style={{ borderRadius: '8px' }}
              >
                Start Cloning This Video
                <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
              </Link>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-sm text-gray-500">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <a
                href={BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-white border-2 border-black text-black font-medium hover:bg-gray-50 transition-colors"
                style={{ borderRadius: '8px' }}
              >
                <Mail className="w-4 h-4" strokeWidth={1.5} />
                Book a Demo
              </a>
            </div>
          </div>
        )}

        {/* Idle - Upload Zone */}
        {state === 'idle' && (
          <UploadZoneRefined onFileSelect={handleFileSelect} />
        )}
      </div>

      {/* RIGHT COLUMN - Video Preview (Sticky) */}
      {hasVideo && uploadedVideoUrl && (
        <div className="lg:sticky lg:top-4 h-fit">
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-500 tracking-wide uppercase">Your Video</p>
            <div className="relative bg-gray-100 border-2 border-gray-300 overflow-hidden" style={{ aspectRatio: '9/16' }}>
              <video
                src={uploadedVideoUrl}
                controls
                className="w-full h-full object-contain"
                style={{ backgroundColor: '#000' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
