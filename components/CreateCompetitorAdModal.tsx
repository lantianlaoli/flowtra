'use client';

import { useState, useEffect } from 'react';
import { X, Upload, Loader2, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CompetitorAd } from '@/lib/supabase';

interface CreateCompetitorAdModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandId: string;
  brandName: string;
  onCompetitorAdCreated: (competitorAd: CompetitorAd) => void;
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

export default function CreateCompetitorAdModal({
  isOpen,
  onClose,
  brandId,
  brandName,
  onCompetitorAdCreated
}: CreateCompetitorAdModalProps) {
  const [competitorName, setCompetitorName] = useState('');
  const [platform, setPlatform] = useState('Facebook');
  const [adFile, setAdFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCompetitorName('');
      setPlatform('Facebook');
      setAdFile(null);
      setFilePreview(null);
      setFileType(null);
      setError(null);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isCreating) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isCreating, onClose]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        setError('Please upload an image or video file');
        return;
      }

      // Validate file size
      const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`File size must be less than ${isVideo ? '100MB' : '10MB'}`);
        return;
      }

      setAdFile(file);
      setFileType(isVideo ? 'video' : 'image');

      // Generate preview
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!competitorName.trim()) {
      setError('Competitor name is required');
      return;
    }

    if (!adFile) {
      setError('Advertisement file is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('brand_id', brandId);
      formData.append('competitor_name', competitorName.trim());
      formData.append('platform', platform);
      formData.append('ad_file', adFile);

      const response = await fetch('/api/competitor-ads', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        onCompetitorAdCreated(data.competitorAd);
        onClose();
      } else {
        setError(data.error || data.details || 'Failed to create competitor ad');
      }
    } catch (err) {
      console.error('Error creating competitor ad:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isCreating && onClose()}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add Competitor Ad</h2>
                <p className="text-sm text-gray-600">For {brandName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isCreating}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Competitor Name */}
            <div>
              <label htmlFor="competitor-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Competitor Name <span className="text-red-500">*</span>
              </label>
              <input
                id="competitor-name"
                type="text"
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                placeholder="e.g., Lovevery, Montessori Toys"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isCreating}
                required
              />
            </div>

            {/* Platform */}
            <div>
              <label htmlFor="platform" className="block text-sm font-medium text-gray-700 mb-1.5">
                Platform <span className="text-red-500">*</span>
              </label>
              <select
                id="platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isCreating}
                required
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Advertisement File <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <label
                  htmlFor="ad-file"
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {adFile ? adFile.name : 'Click to upload image or video'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Images: max 10MB | Videos: max 100MB
                    </p>
                  </div>
                  <input
                    id="ad-file"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isCreating}
                  />
                </label>
              </div>

              {/* File Preview */}
              {filePreview && (
                <div className="mt-3">
                  {fileType === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <video
                      src={filePreview}
                      controls
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  )}
                </div>
              )}
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
                disabled={isCreating}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !competitorName.trim() || !adFile}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
