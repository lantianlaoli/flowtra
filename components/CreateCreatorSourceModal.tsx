'use client';

import { useEffect, useState } from 'react';
import { X, Users, Loader2 } from 'lucide-react';
import { SiTiktok } from 'react-icons/si';
import { motion, AnimatePresence } from 'framer-motion';
import CreatorSourceProgressModal from './CreatorSourceProgressModal';

interface CreatorSource {
  id: string;
  source_name: string;
  creator_source_platforms?: Array<{
    id: string;
    platform: string;
    handle: string;
    profile_url?: string | null;
    avatar_url?: string | null;
    display_name?: string | null;
    stats?: Record<string, unknown> | null;
  }>;
  creator_source_videos?: Array<{
    id: string;
    platform: string;
    video_url: string;
    description?: string | null;
    duration_seconds?: number | null;
  }>;
}

interface CreateCreatorSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (source: CreatorSource) => void;
  onError?: (error: string) => void;
}

export default function CreateCreatorSourceModal({
  isOpen,
  onClose,
  onCreated,
  onError
}: CreateCreatorSourceModalProps) {
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [videoCount, setVideoCount] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTiktokHandle('');
      setPlatform('tiktok');
      setError(null);
      setTimeout(() => {
        const input = document.querySelector('#creator-source-handle-input') as HTMLInputElement;
        if (input) input.focus();
      }, 150);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!tiktokHandle.trim()) {
      setError('TikTok username is required');
      return;
    }

    // Step 1: Close input modal, show progress modal
    onClose();
    setShowProgressModal(true);
    setError(null);

    try {
      // Step 2: Call API
      const response = await fetch('/api/creator-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiktok_handle: tiktokHandle.trim(),
          video_count: videoCount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create creator source');
      }

      // Step 3: Signal success to progress modal
      setApiComplete(true);

      // Step 4: After success animation (1.5s), close and trigger callback
      setTimeout(() => {
        setShowProgressModal(false);
        setApiComplete(false);
        setTiktokHandle('');
        onCreated(data.source || data);
      }, 1500);

    } catch (submitError) {
      // Error: Close progress modal, call parent error handler
      setShowProgressModal(false);
      setApiComplete(false);
      const errorMsg = submitError instanceof Error
        ? submitError.message
        : 'Failed to create creator source';

      if (onError) {
        onError(errorMsg);  // Parent will show error toast
      } else {
        setError(errorMsg);  // Fallback: show in input modal
      }
    }
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Add Creator Source</h3>
                  <p className="text-sm text-gray-600">Connect a TikTok creator profile.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label htmlFor="creator-source-platform" className="block text-sm font-medium text-gray-700 mb-2">
                  Platform
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white">
                    <SiTiktok className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <select
                    id="creator-source-platform"
                    value={platform}
                    onChange={(event) => setPlatform(event.target.value)}
                    className="w-full pl-12 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                  >
                    <option value="tiktok">TikTok</option>
                  </select>
                </div>
              </div>

              {platform === 'tiktok' && (
                <>
                  <div>
                    <label htmlFor="creator-source-handle-input" className="block text-sm font-medium text-gray-700 mb-2">
                      TikTok Username
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                        @
                      </span>
                      <input
                        id="creator-source-handle-input"
                        type="text"
                        value={tiktokHandle}
                        onChange={(event) => setTiktokHandle(event.target.value)}
                        placeholder="creator"
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="video-count" className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Videos
                    </label>
                    <select
                      id="video-count"
                      value={videoCount}
                      onChange={(event) => setVideoCount(Number(event.target.value))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                        <option key={num} value={num}>
                          {num} {num === 1 ? 'video' : 'videos'}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Fetch the most recent videos from this creator
                    </p>
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  disabled={isSubmitting}
                >
                  Connect
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <CreatorSourceProgressModal
        isOpen={showProgressModal}
        apiComplete={apiComplete}
        onComplete={() => {
          setShowProgressModal(false);
          setApiComplete(false);
        }}
      />
    </>
  );
}
