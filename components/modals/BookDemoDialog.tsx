'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { X, Mail, AlertCircle, CheckCircle2, ArrowUpRight, Loader2 } from 'lucide-react';
import { FaDiscord } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

interface BookDemoDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type FeatureType = 'avatar-ads' | 'competitor-cloning';
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export function BookDemoDialog({ isOpen, onClose }: BookDemoDialogProps) {
  const { user, isLoaded } = useUser();
  const [selectedFeatures, setSelectedFeatures] = useState<Set<FeatureType>>(new Set());
  const [resourceLinks, setResourceLinks] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const discordInviteUrl = process.env.NEXT_PUBLIC_DISCORD || 'https://discord.gg/gStwqdpRzt';

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedFeatures(new Set());
      setResourceLinks('');
      setValidationError(null);
      setSubmitStatus('idle');
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Handle ESC key (only when not submitting)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && submitStatus !== 'submitting') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, submitStatus, onClose]);

  const toggleFeature = (feature: FeatureType) => {
    setSelectedFeatures((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(feature)) {
        newSet.delete(feature);
      } else {
        newSet.add(feature);
      }
      return newSet;
    });
    // Clear validation error when user selects a feature
    if (validationError) {
      setValidationError(null);
    }
  };

  const getPlaceholder = () => {
    const hasAvatar = selectedFeatures.has('avatar-ads');
    const hasClone = selectedFeatures.has('competitor-cloning');

    if (hasAvatar && hasClone) {
      return 'Product image links, TikTok video links, or related information (optional)';
    } else if (hasAvatar) {
      return 'Product image links or related information (optional)';
    } else if (hasClone) {
      return 'TikTok link of video you want to clone or related information (optional)';
    }
    return 'Resource links or related information (optional)';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check authentication
    if (!isLoaded || !user?.id) {
      setValidationError('Please sign in to book a demo');
      return;
    }

    // Validate features
    if (selectedFeatures.size === 0) {
      setValidationError('Please select at least one feature you want to test');
      return;
    }

    setSubmitStatus('submitting');
    setValidationError(null);

    try {
      const response = await fetch('/api/book-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedFeatures: Array.from(selectedFeatures),
          resourceLinks: resourceLinks.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send demo request');
      }

      // Success - show Discord invite
      setSubmitStatus('success');
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to send demo request'
      );
      setSubmitStatus('error');
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && submitStatus !== 'submitting') {
      onClose();
    }
  };

  const handleRetry = () => {
    setSubmitStatus('idle');
    setErrorMessage(null);
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

          {/* Modal Card */}
          <motion.div
            className="relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Book a Demo</h3>
                  <p className="text-sm text-gray-600">Tell us what you&apos;d like to try</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={submitStatus === 'submitting'}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Idle State: Form */}
            {submitStatus === 'idle' && (
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Feature Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    What would you like to test? *
                  </label>
                  <div
                    className={`space-y-2.5 ${
                      validationError ? 'border-2 border-red-300 rounded-lg p-3' : ''
                    }`}
                  >
                    <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.has('avatar-ads')}
                        onChange={() => toggleFeature('avatar-ads')}
                        className="w-4 h-4 text-black border-gray-300 rounded"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Avatar Ads</span>
                        <p className="text-xs text-gray-600">Talking character videos</p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.has('competitor-cloning')}
                        onChange={() => toggleFeature('competitor-cloning')}
                        className="w-4 h-4 text-black border-gray-300 rounded"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          Competitor Cloning
                        </span>
                        <p className="text-xs text-gray-600">
                          Recreate successful ads with your product
                        </p>
                      </div>
                    </label>
                  </div>
                  {validationError && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}
                </div>

                {/* Resource Links */}
                <div>
                  <label
                    htmlFor="resource-links"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Your Materials (Optional)
                  </label>
                  <textarea
                    id="resource-links"
                    value={resourceLinks}
                    onChange={(e) => setResourceLinks(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors resize-none"
                    placeholder={getPlaceholder()}
                    rows={4}
                    maxLength={500}
                  />
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Share links to products, videos, or any relevant info
                    </p>
                    <p className="text-xs text-gray-500">{resourceLinks.length}/500</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={selectedFeatures.size === 0}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Send Request
                  </button>
                </div>
              </form>
            )}

            {/* Submitting State */}
            {submitStatus === 'submitting' && (
              <div className="p-6">
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-gray-900 animate-spin mb-4" />
                  <p className="text-sm font-medium text-gray-900">Sending your request...</p>
                  <p className="text-xs text-gray-600 mt-1">This will only take a moment</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {submitStatus === 'error' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-900">{errorMessage}</p>
                </div>
                <button
                  onClick={handleRetry}
                  className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Success State */}
            {submitStatus === 'success' && (
              <div className="p-6 space-y-4">
                {/* Success message */}
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      Demo request sent successfully!
                    </p>
                    <p className="text-xs text-green-700">We&apos;ll get back to you soon.</p>
                  </div>
                </div>

                {/* Discord invite */}
                <div className="p-4 bg-[#5865F2]/5 border border-[#5865F2]/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FaDiscord className="w-5 h-5 text-[#5865F2]" />
                    <p className="text-sm font-semibold text-gray-900">
                      Join our Discord community
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">
                    Get instant support and connect with other users while you wait.
                  </p>
                  <a
                    href={discordInviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#5865F2] text-white rounded-lg hover:bg-[#4752C4] transition-colors text-sm font-medium"
                  >
                    <FaDiscord className="w-4 h-4" />
                    <span>Join Discord</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
