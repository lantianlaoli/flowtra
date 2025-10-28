'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface TikTokPublishDialogProps {
  isOpen: boolean;
  onClose: () => void;
  historyId: string;
  coverImageUrl?: string;
}

type PrivacyLevel = 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';

type PublishStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'failed';

export default function TikTokPublishDialog({
  isOpen,
  onClose,
  historyId,
  coverImageUrl
}: TikTokPublishDialogProps) {
  const [title, setTitle] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>('PUBLIC_TO_EVERYONE');
  const [disableDuet, setDisableDuet] = useState(false);
  const [disableComment, setDisableComment] = useState(false);
  const [disableStitch, setDisableStitch] = useState(false);
  const [status, setStatus] = useState<PublishStatus>('idle');
  const [publishId, setPublishId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setPrivacyLevel('PUBLIC_TO_EVERYONE');
      setDisableDuet(false);
      setDisableComment(false);
      setDisableStitch(false);
      setStatus('idle');
      setPublishId(null);
      setErrorMessage(null);
      setPostId(null);
    }
  }, [isOpen]);

  // Poll status if we have a publishId
  useEffect(() => {
    if (!publishId || status !== 'processing') return;

    let isCancelled = false;
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/tiktok/publish/status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ publishId })
        });

        const result = await response.json();

        if (!isCancelled) {
          if (result.success) {
            if (result.isComplete) {
              setStatus('success');
              setPostId(result.postId);
              clearInterval(pollInterval);
            } else if (result.isFailed) {
              setStatus('failed');
              setErrorMessage(result.failReason || 'TikTok rejected the video');
              clearInterval(pollInterval);
            }
            // Otherwise keep polling (still processing)
          } else {
            setStatus('failed');
            setErrorMessage(result.error || 'Failed to check status');
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Status polling error:', error);
          // Don't fail immediately - TikTok might still be processing
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
    };
  }, [publishId, status]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    setStatus('uploading');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/tiktok/publish/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          historyId,
          title: title.trim(),
          privacyLevel,
          disableDuet,
          disableComment,
          disableStitch,
          videoCoverTimestampMs: 1000
        })
      });

      const result = await response.json();

      if (result.success) {
        setPublishId(result.publishId);
        setStatus('processing');
      } else {
        setStatus('failed');
        setErrorMessage(result.error || 'Failed to publish video');
      }
    } catch (error) {
      console.error('Publish error:', error);
      setStatus('failed');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && status === 'idle') {
      onClose();
    }
  };

  const handleClose = () => {
    if (status !== 'uploading' && status !== 'processing') {
      onClose();
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />;
      case 'success':
        return <Check className="w-6 h-6 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading video to TikTok...';
      case 'processing':
        return 'TikTok is processing your video...';
      case 'success':
        return 'Successfully published to TikTok!';
      case 'failed':
        return 'Failed to publish';
      default:
        return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Dialog Card */}
          <motion.div
            className="relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            {/* Close button */}
            {status !== 'uploading' && status !== 'processing' && (
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors z-10"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}

            {/* Content */}
            <div className="p-6">
              {/* Title with TikTok branding */}
              <div className="flex items-center gap-3 mb-6">
                <div className="relative w-12 h-12 rounded-xl bg-black flex items-center justify-center overflow-hidden">
                  {/* Animated gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#00f2ea] via-[#ff0050] to-[#00f2ea] opacity-20 animate-tiktok-shimmer bg-[length:200%_200%]" />

                  {/* TikTok icon */}
                  <svg
                    className="w-7 h-7 fill-white relative z-10"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                  </svg>
                </div>
                <div>
                  <h3
                    id="dialog-title"
                    className="text-xl font-bold text-gray-900"
                  >
                    Post to TikTok
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">Share your video with the world</p>
                </div>
              </div>

              {/* Status Message */}
              {status !== 'idle' && (
                <div className={cn(
                  "mb-6 p-4 rounded-xl border flex items-start gap-3 transition-all",
                  status === 'success' && "bg-green-50 border-green-200",
                  status === 'failed' && "bg-red-50 border-red-200",
                  (status === 'uploading' || status === 'processing') && "bg-blue-50 border-blue-200"
                )}>
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon()}
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      "text-sm font-semibold",
                      status === 'success' && "text-green-900",
                      status === 'failed' && "text-red-900",
                      (status === 'uploading' || status === 'processing') && "text-blue-900"
                    )}>
                      {getStatusText()}
                    </p>
                    {errorMessage && (
                      <p className="text-sm text-red-700 mt-1.5 leading-relaxed">
                        {errorMessage}
                      </p>
                    )}
                    {postId && (
                      <a
                        href={`https://www.tiktok.com/@me/video/${postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 mt-2 group"
                      >
                        <span>View on TikTok</span>
                        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Preview */}
              {coverImageUrl && status === 'idle' && (
                <div className="mb-4">
                  <div className="relative w-full aspect-[9/16] max-w-[200px] mx-auto rounded-lg overflow-hidden border border-gray-200">
                    <Image
                      src={coverImageUrl}
                      alt="Video cover"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Form */}
              {status === 'idle' && (
                <div className="space-y-4">
                  {/* Title */}
                  <div>
                    <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-2">
                      Video Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Make it catchy..."
                      maxLength={150}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-black focus:border-black transition-all text-sm"
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-500">
                        Create an engaging title for your video
                      </p>
                      <p className={cn(
                        "text-xs font-medium",
                        title.length > 140 ? "text-orange-600" : "text-gray-400"
                      )}>
                        {title.length}/150
                      </p>
                    </div>
                  </div>

                  {/* Privacy Level */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Who can watch this video?
                    </label>
                    <div className="space-y-2.5">
                      <label className={cn(
                        "flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all hover:border-gray-300",
                        privacyLevel === 'PUBLIC_TO_EVERYONE' ? "border-black bg-gray-50" : "border-gray-200"
                      )}>
                        <input
                          type="radio"
                          name="privacy"
                          checked={privacyLevel === 'PUBLIC_TO_EVERYONE'}
                          onChange={() => setPrivacyLevel('PUBLIC_TO_EVERYONE')}
                          className="w-4 h-4 text-black border-gray-300"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">Public</span>
                          <p className="text-xs text-gray-500 mt-0.5">Everyone can watch</p>
                        </div>
                      </label>
                      <label className={cn(
                        "flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all hover:border-gray-300",
                        privacyLevel === 'MUTUAL_FOLLOW_FRIENDS' ? "border-black bg-gray-50" : "border-gray-200"
                      )}>
                        <input
                          type="radio"
                          name="privacy"
                          checked={privacyLevel === 'MUTUAL_FOLLOW_FRIENDS'}
                          onChange={() => setPrivacyLevel('MUTUAL_FOLLOW_FRIENDS')}
                          className="w-4 h-4 text-black border-gray-300"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">Friends</span>
                          <p className="text-xs text-gray-500 mt-0.5">Only friends can watch</p>
                        </div>
                      </label>
                      <label className={cn(
                        "flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all hover:border-gray-300",
                        privacyLevel === 'SELF_ONLY' ? "border-black bg-gray-50" : "border-gray-200"
                      )}>
                        <input
                          type="radio"
                          name="privacy"
                          checked={privacyLevel === 'SELF_ONLY'}
                          onChange={() => setPrivacyLevel('SELF_ONLY')}
                          className="w-4 h-4 text-black border-gray-300"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">Private</span>
                          <p className="text-xs text-gray-500 mt-0.5">Only you can watch</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Options */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Interaction Settings
                    </label>
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={disableDuet}
                          onChange={(e) => setDisableDuet(e.target.checked)}
                          className="w-4 h-4 text-black border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">Turn off Duet</span>
                      </label>
                      <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={disableComment}
                          onChange={(e) => setDisableComment(e.target.checked)}
                          className="w-4 h-4 text-black border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">Turn off Comments</span>
                      </label>
                      <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={disableStitch}
                          onChange={(e) => setDisableStitch(e.target.checked)}
                          className="w-4 h-4 text-black border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">Turn off Stitch</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3">
                {status === 'idle' ? (
                  <>
                    <button
                      onClick={handleClose}
                      className="flex-1 px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!title.trim()}
                      className="group relative flex-1 overflow-hidden rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {/* Gradient background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-[#00f2ea] via-[#ff0050] to-[#00f2ea] bg-[length:200%_100%] animate-tiktok-shimmer" />

                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-black/80 group-hover:bg-black/70 transition-colors" />

                      {/* Button content */}
                      <div className="relative flex items-center justify-center gap-2 px-5 py-2.5">
                        <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                        </svg>
                        <span className="font-bold text-white">Publish to TikTok</span>
                      </div>
                    </button>
                  </>
                ) : status === 'success' || status === 'failed' ? (
                  <button
                    onClick={handleClose}
                    className="w-full px-5 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-semibold"
                  >
                    Close
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full px-5 py-3 bg-gray-100 text-gray-400 rounded-xl cursor-not-allowed font-semibold flex items-center justify-center gap-2"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing...</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
