'use client';

import { useState, useEffect } from 'react';
import { X, UserCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserAvatar } from '@/lib/supabase';

interface EditAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  avatar: UserAvatar | null;
  onAvatarUpdated: (avatar: UserAvatar) => void;
}

export default function EditAvatarModal({
  isOpen,
  onClose,
  avatar,
  onAvatarUpdated
}: EditAvatarModalProps) {
  const [avatarName, setAvatarName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when modal opens with avatar data
  useEffect(() => {
    if (isOpen && avatar) {
      setAvatarName(avatar.avatar_name);
      setError(null);
      // Auto focus input after modal animation
      setTimeout(() => {
        const input = document.querySelector('#edit-avatar-name-input') as HTMLInputElement;
        if (input) {
          input.focus();
          input.select(); // Select all text for easy editing
        }
      }, 150);
    }
  }, [isOpen, avatar]);

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

    if (!avatar) return;

    if (!avatarName.trim()) {
      setError('Avatar name is required');
      return;
    }

    // Check if nothing changed
    if (avatarName.trim() === avatar.avatar_name) {
      onClose();
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/user-avatars?avatarId=${avatar.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          avatarName: avatarName.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update avatar');
      }

      const data = await response.json();
      onAvatarUpdated(data.avatar);
      onClose();
    } catch (error) {
      console.error('Error updating avatar:', error);
      setError(error instanceof Error ? error.message : 'Failed to update avatar. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isUpdating) {
      onClose();
    }
  };

  if (!avatar) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="assets-modal assets-edit-avatar fixed inset-0 z-50 flex items-center justify-center p-4"
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
            className="assets-modal-panel assets-edit-avatar-panel relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md mx-auto"
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
                  <h3 className="assets-modal-title text-lg font-semibold text-gray-900">Edit Avatar</h3>
                  <p className="assets-modal-subtitle text-sm text-gray-600">Update avatar name</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="assets-modal-close w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isUpdating}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="assets-modal-body p-6 space-y-6">
              {/* Avatar Photo Display (Read-only) */}
              <div>
                <label className="assets-modal-label block text-sm font-medium text-gray-700 mb-2">
                  Avatar Photo
                </label>
                <div className="assets-modal-preview w-full h-48 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center p-4">
                  <Image
                    src={avatar.photo_url}
                    alt={avatar.avatar_name}
                    width={300}
                    height={300}
                    className="max-h-full max-w-full object-contain rounded-lg"
                  />
                </div>
                <p className="assets-modal-helper mt-1 text-xs text-gray-500">Photo cannot be changed. Create a new avatar to use a different photo.</p>
              </div>

              {/* Avatar Name Input */}
              <div>
                <label htmlFor="edit-avatar-name-input" className="assets-modal-label block text-sm font-medium text-gray-700 mb-2">
                  Avatar Name *
                </label>
                <input
                  id="edit-avatar-name-input"
                  type="text"
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                  className="assets-modal-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                  placeholder="Enter avatar name"
                  disabled={isUpdating}
                  maxLength={255}
                />
              </div>

              {/* Error Message */}
              {error && (
                <p className="assets-modal-error text-sm text-red-600">{error}</p>
              )}

              {/* Action Buttons */}
              <div className="assets-modal-actions flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="assets-modal-secondary flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || !avatarName.trim()}
                  className="assets-modal-primary flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isUpdating && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
