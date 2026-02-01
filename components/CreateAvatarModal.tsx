'use client';

import { useState, useEffect } from 'react';
import { X, UserCircle, Upload, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserAvatar } from '@/lib/supabase';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';

const GOOD_EXAMPLE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/user-photos/character_ad_example.png';
const BLURRY_EXAMPLE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/competitor_videos/user-photos/character_ad_bad.png';

interface CreateAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAvatarCreated: (avatar: UserAvatar) => void;
}

export default function CreateAvatarModal({
  isOpen,
  onClose,
  onAvatarCreated
}: CreateAvatarModalProps) {
  const [avatarName, setAvatarName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setAvatarName('');
      setAvatarFile(null);
      setAvatarPreview(null);
      setError(null);
      // Auto focus input after modal animation
      setTimeout(() => {
        const input = document.querySelector('#avatar-name-input') as HTMLInputElement;
        if (input) input.focus();
      }, 150);
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

  const renderErrorMessage = (message: string) => {
    if (!message.includes(IMAGE_CONVERSION_LINK)) {
      return message;
    }
    const [before, after] = message.split(IMAGE_CONVERSION_LINK);
    return (
      <>
        {before}
        <a
          href={IMAGE_CONVERSION_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-red-800"
        >
          {IMAGE_CONVERSION_LINK}
        </a>
        {after}
      </>
    );
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validationResult = validateImageFormat(file);
      if (!validationResult.isValid) {
        setError(validationResult.error);
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError('Avatar file size must be less than 8MB');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!avatarName.trim()) {
      setError('Avatar name is required');
      return;
    }

    if (!avatarFile) {
      setError('Please select an avatar image');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', avatarFile);
      formData.append('avatarName', avatarName.trim());

      const response = await fetch('/api/user-avatars', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create avatar');
      }

      const data = await response.json();
      onAvatarCreated(data.avatar);
      onClose();
    } catch (error) {
      console.error('Error creating avatar:', error);
      setError(error instanceof Error ? error.message : 'Failed to create avatar. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isCreating) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="assets-modal assets-create-avatar fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="assets-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Card */}
          <motion.div
            className="assets-modal-panel assets-create-avatar-panel relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="assets-modal-header flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="assets-modal-icon w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="assets-modal-title text-lg font-semibold text-gray-900">Add New Avatar</h3>
                  <p className="assets-modal-subtitle text-sm text-gray-600">Upload character photo with a name</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="assets-modal-close w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isCreating}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="assets-modal-body p-6 space-y-6">
              {/* Portrait Examples */}
              <div className="assets-modal-card rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h4 className="assets-modal-card-title text-sm font-semibold text-gray-800 mb-3">Portrait Photo Examples</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center">
                    <div className="assets-modal-example-good w-24 h-24 rounded-full overflow-hidden border-2 border-green-500 shadow-sm mb-2">
                      <Image
                        src={GOOD_EXAMPLE_URL}
                        alt="Good example"
                        width={96}
                        height={96}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <span className="assets-modal-example-label text-xs font-medium text-green-700">Good Example</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="assets-modal-example-bad w-24 h-24 rounded-full overflow-hidden border-2 border-red-500 shadow-sm mb-2">
                      <Image
                        src={BLURRY_EXAMPLE_URL}
                        alt="Bad example (blurry)"
                        width={96}
                        height={96}
                        className="object-cover w-full h-full"
                      />
                    </div>
                    <span className="assets-modal-example-label text-xs font-medium text-red-700">Bad Example (Blurry)</span>
                  </div>
                </div>
                <p className="assets-modal-helper text-xs text-gray-500 mt-3">
                  Use a clear, well-lit, front-facing portrait of a single person. Avoid blurry or low-resolution images.
                </p>
              </div>

              {/* Avatar Name Input */}
              <div>
                <label htmlFor="avatar-name-input" className="assets-modal-label block text-sm font-medium text-gray-700 mb-2">
                  Avatar Name *
                </label>
                <input
                  id="avatar-name-input"
                  type="text"
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                  className="assets-modal-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                  placeholder="e.g., Founder, Model, Demo Character"
                  disabled={isCreating}
                  maxLength={255}
                />
              </div>

              {/* Avatar Photo Upload */}
              <div>
                <label className="assets-modal-label block text-sm font-medium text-gray-700 mb-2">
                  Avatar Photo *
                </label>
                <div className="space-y-3">
                  {avatarPreview ? (
                    <div className="relative">
                      <div className="assets-modal-preview w-full h-48 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center p-4">
                        <Image
                          src={avatarPreview}
                          alt="Avatar preview"
                          width={300}
                          height={300}
                          className="max-h-full max-w-full object-contain rounded-lg"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarFile(null);
                          setAvatarPreview(null);
                        }}
                        className="assets-modal-thumb-remove absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        disabled={isCreating}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept={getAcceptedImageFormats()}
                        onChange={handleAvatarUpload}
                        className="hidden"
                        disabled={isCreating}
                      />
                      <div className="assets-modal-upload w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-gray-400 cursor-pointer transition-colors">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Click to upload avatar photo</p>
                        <p className="assets-modal-helper text-xs text-gray-500">PNG, JPG up to 8MB</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <p className="assets-modal-error text-sm text-red-600">{renderErrorMessage(error)}</p>
              )}

              {/* Action Buttons */}
              <div className="assets-modal-actions flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="assets-modal-secondary flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !avatarName.trim() || !avatarFile}
                  className="assets-modal-primary flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isCreating && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {isCreating ? 'Creating...' : 'Create Avatar'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
