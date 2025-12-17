'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, Loader2 } from 'lucide-react';
import { UserAvatar } from '@/lib/supabase';
import { motion } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';

interface AvatarCardProps {
  avatar: UserAvatar;
  onEdit: (avatar: UserAvatar) => void;
  onDelete: (avatarId: string) => void;
  isDeleting?: boolean;
  mode?: 'full' | 'compact' | 'selectable';
  onSelect?: (avatar: UserAvatar) => void;
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
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isSelectableMode = mode === 'selectable';
  const isFullMode = mode === 'full';

  const handleCardClick = () => {
    if (isSelectableMode && onSelect) {
      onSelect(avatar);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(avatar);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleting) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    onDelete(avatar.id);
  };

  return (
    <>
      <motion.div
        className={`
          relative group bg-white rounded-lg border overflow-hidden transition-all duration-200
          ${isSelectableMode ? 'cursor-pointer hover:border-gray-400' : ''}
          ${isSelected ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-200'}
          ${isDeleting ? 'opacity-50 pointer-events-none' : ''}
        `}
        onClick={handleCardClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
      >
        {/* Avatar Image */}
        <div className="relative w-full aspect-square">
          <Image
            src={avatar.photo_url}
            alt={avatar.avatar_name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />

          {/* Overlay with actions on hover (full mode only) */}
          {isFullMode && isHovered && !isDeleting && (
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                onClick={handleEditClick}
                className="w-9 h-9 bg-white rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors shadow-sm"
                title="Edit avatar"
              >
                <Edit2 className="w-4 h-4 text-gray-700" />
              </button>
              <button
                onClick={handleDeleteClick}
                className="w-9 h-9 bg-white rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors shadow-sm"
                title="Delete avatar"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </motion.div>
          )}

          {/* Deleting indicator */}
          {isDeleting && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-gray-900 animate-spin" />
            </div>
          )}

          {/* Selected indicator */}
          {isSelected && isSelectableMode && (
            <div className="absolute top-2 right-2 w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        {/* Avatar Name */}
        <div className="p-3 bg-white border-t border-gray-100">
          <p className="text-sm font-medium text-gray-900 truncate" title={avatar.avatar_name}>
            {avatar.avatar_name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(avatar.created_at).toLocaleDateString()}
          </p>
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
