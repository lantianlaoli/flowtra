'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, Loader2 } from 'lucide-react';
import { UserAvatar } from '@/lib/supabase';
import type { SystemAvatar } from '@/lib/default-avatars';
import { motion } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';

type AvatarCardItem = UserAvatar | SystemAvatar;

interface AvatarCardProps {
  avatar: AvatarCardItem;
  onEdit: (avatar: AvatarCardItem) => void;
  onDelete: (avatarId: string) => void;
  isDeleting?: boolean;
  mode?: 'full' | 'compact' | 'selectable';
  onSelect?: (avatar: AvatarCardItem) => void;
  isSelected?: boolean;
}

export default function AvatarCard({
  avatar,
  onEdit,
  onDelete,
  isDeleting = false,
  mode = 'full',
  onSelect,
  isSelected = false
}: AvatarCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const isSystemAvatar = Boolean((avatar as SystemAvatar).isSystem);

  const isSelectableMode = mode === 'selectable';
  const isFullMode = mode === 'full';

  const handleCardClick = () => {
    if (isSelectableMode && onSelect) {
      onSelect(avatar);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSystemAvatar) return;
    onEdit(avatar);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting || isSystemAvatar) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    onDelete(avatar.id);
  };

  return (
    <>
      <motion.div
        className={`
          assets-avatar-card relative group bg-white rounded-lg border overflow-hidden transition-all duration-200
          ${isSelectableMode ? 'cursor-pointer hover:border-gray-400' : ''}
          ${isSelected ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-200'}
          ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
        `}
        onClick={handleCardClick}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
      >
        {/* Avatar Image */}
        <div className="assets-avatar-card-media relative w-full aspect-square">
          <Image
            src={avatar.photo_url}
            alt={avatar.avatar_name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />

          {/* Deleting indicator */}
          {isDeleting && (
            <div className="assets-avatar-card-loading absolute inset-0 bg-white/80 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-gray-900 animate-spin" />
            </div>
          )}

          {/* Selected indicator */}
          {isSelected && isSelectableMode && (
            <div className="assets-avatar-card-selected absolute top-2 right-2 w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {/* Avatar Name */}
        <div className="assets-avatar-card-body p-3 bg-white border-t border-gray-100">
          <p className="assets-avatar-card-title text-sm font-medium text-gray-900 truncate" title={avatar.avatar_name}>
            {avatar.avatar_name}
          </p>
          <div className="flex items-center justify-between mt-1">
            <p className="assets-avatar-card-meta text-xs text-gray-500">
              {new Date(avatar.created_at).toLocaleDateString()}
            </p>
            {isFullMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleEditClick}
                  className={`assets-avatar-card-action p-1.5 rounded-lg transition-colors ${isSystemAvatar ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}
                  title={isSystemAvatar ? 'System avatar' : 'Edit avatar'}
                  disabled={isSystemAvatar}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDeleteClick}
                  className={`assets-avatar-card-action assets-avatar-card-danger p-1.5 rounded-lg transition-colors ${isSystemAvatar ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-black hover:bg-gray-100'}`}
                  title={isSystemAvatar ? 'System avatar' : (isDeleting ? 'Deleting...' : 'Delete avatar')}
                  disabled={isSystemAvatar}
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Avatar"
        message={`Are you sure you want to delete "${avatar.avatar_name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}
