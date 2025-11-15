'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompetitorAd } from '@/lib/supabase';

interface EditCompetitorAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  competitorAd: CompetitorAd | null;
  onCompetitorAdUpdated: (competitorAd: CompetitorAd) => void;
}

const PLATFORMS = [
  'Facebook',
  'Instagram',
  'TikTok',
  'YouTube',
  'Twitter/X',
  'LinkedIn',
  'Snapchat',
  'Pinterest',
  'Other'
];

export default function EditCompetitorAdModal({
  isOpen,
  onClose,
  competitorAd,
  onCompetitorAdUpdated
}: EditCompetitorAdModalProps) {
  const [competitorName, setCompetitorName] = useState('');
  const [platform, setPlatform] = useState('Facebook');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load competitor ad data when modal opens
  useEffect(() => {
    if (isOpen && competitorAd) {
      setCompetitorName(competitorAd.competitor_name);
      setPlatform(competitorAd.platform);
      setError(null);
    }
  }, [isOpen, competitorAd]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isUpdating) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isUpdating, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!competitorAd) return;

    if (!competitorName.trim()) {
      setError('Competitor name is required');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/competitor-ads/${competitorAd.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          competitor_name: competitorName.trim(),
          platform: platform
        })
      });

      const data = await response.json();

      if (response.ok) {
        onCompetitorAdUpdated(data.competitorAd);
        onClose();
      } else {
        setError(data.error || data.details || 'Failed to update competitor ad');
      }
    } catch (err) {
      console.error('Error updating competitor ad:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen || !competitorAd) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isUpdating && onClose()}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-md"
        >
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Edit Competitor Ad</h2>
            </div>
            <button
              onClick={onClose}
              disabled={isUpdating}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Competitor Name */}
            <div>
              <label htmlFor="edit-competitor-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Competitor Name <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-competitor-name"
                type="text"
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                placeholder="e.g., Lovevery, Montessori Toys"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isUpdating}
                required
              />
            </div>

            {/* Platform */}
            <div>
              <label htmlFor="edit-platform" className="block text-sm font-medium text-gray-700 mb-1.5">
                Platform <span className="text-red-500">*</span>
              </label>
              <select
                id="edit-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isUpdating}
                required
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                Note: You cannot change the advertisement file. To use a different file, please delete this ad and create a new one.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isUpdating}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating || !competitorName.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
