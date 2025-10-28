'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';
import Image from 'next/image';

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
              <h3
                id="dialog-title"
                className="text-xl font-semibold text-gray-900 mb-4"
              >
                Post to TikTok
              </h3>

              {/* Status Message */}
              {status !== 'idle' && (
                <div className="mb-4 p-4 rounded-lg border bg-gray-50 flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {getStatusText()}
                    </p>
                    {errorMessage && (
                      <p className="text-sm text-red-600 mt-1">
                        {errorMessage}
                      </p>
                    )}
                    {postId && (
                      <a
                        href={`https://www.tiktok.com/@me/video/${postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                      >
                        View on TikTok →
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
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter video title"
                      maxLength={150}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {title.length}/150 characters
                    </p>
                  </div>

                  {/* Privacy Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Privacy Level
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="privacy"
                          checked={privacyLevel === 'PUBLIC_TO_EVERYONE'}
                          onChange={() => setPrivacyLevel('PUBLIC_TO_EVERYONE')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">Public</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="privacy"
                          checked={privacyLevel === 'MUTUAL_FOLLOW_FRIENDS'}
                          onChange={() => setPrivacyLevel('MUTUAL_FOLLOW_FRIENDS')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">Friends</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="privacy"
                          checked={privacyLevel === 'SELF_ONLY'}
                          onChange={() => setPrivacyLevel('SELF_ONLY')}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">Private</span>
                      </label>
                    </div>
                  </div>

                  {/* Options */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={disableDuet}
                          onChange={(e) => setDisableDuet(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Disable Duet</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={disableComment}
                          onChange={(e) => setDisableComment(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Disable Comments</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={disableStitch}
                          onChange={(e) => setDisableStitch(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-sm text-gray-700">Disable Stitch</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
                {status === 'idle' ? (
                  <>
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!title.trim()}
                      className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Publish to TikTok
                    </button>
                  </>
                ) : status === 'success' || status === 'failed' ? (
                  <button
                    onClick={handleClose}
                    className="w-full px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                  >
                    Close
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full px-4 py-2.5 bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed font-medium"
                  >
                    Publishing...
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
