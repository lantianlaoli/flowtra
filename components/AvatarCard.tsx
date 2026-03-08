'use client';

import Image from 'next/image';
import { Eye, Trash2 } from 'lucide-react';
import { UserAvatar } from '@/lib/supabase';
import type { SystemAvatar } from '@/lib/default-avatars';
import { motion } from 'framer-motion';

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
  isDeleting = false,
  mode = 'full',
  onSelect,
  isSelected = false
}: AvatarCardProps) {
  const isSystemAvatar = Boolean((avatar as SystemAvatar).isSystem);

  const isSelectableMode = mode === 'selectable';
  const isFullMode = mode === 'full';

  const deletingOverlay = isDeleting ? (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[rgba(255,255,255,0.9)]"
    >
      <motion.div
        animate={{ rotate: [0, -10, 10, -6, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-[0_12px_30px_rgba(15,15,15,0.16)]"
      >
        <Trash2 className="h-5 w-5" />
      </motion.div>
      <p className="text-sm font-semibold text-[#1f1f1e]">Removing…</p>
    </motion.div>
  ) : null;

  const handleCardClick = () => {
    if (isSelectableMode && onSelect) {
      onSelect(avatar);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(avatar);
  };

  return (
    <motion.div
        className={`
          assets-avatar-card relative bg-white rounded-xl border overflow-hidden transition-all duration-200
          ${isSelectableMode ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm' : 'hover:border-gray-300 hover:shadow-sm'}
          ${isSelected ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-200'}
          ${isDeleting ? 'pointer-events-none' : ''}
        `}
        onClick={handleCardClick}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        whileHover={isDeleting ? undefined : { y: -2 }}
      >
        <div className="assets-avatar-card-media relative w-full aspect-square">
          <Image
            src={avatar.photo_url}
            alt={avatar.avatar_name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
          {isSelected && isSelectableMode && (
            <div className="assets-avatar-card-selected absolute top-2 right-2 w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>

        <div className="assets-avatar-card-body p-3 bg-white border-t border-gray-100">
          <p className="assets-avatar-card-title text-sm font-medium text-gray-900 truncate" title={avatar.avatar_name}>
            {avatar.avatar_name}
          </p>
          <div className="mt-3 flex items-center gap-2">
            {isFullMode && (
              <>
                <button
                  onClick={handleEditClick}
                  className="assets-avatar-card-action w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-lg border border-black bg-black px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
                  title={isSystemAvatar ? 'View system avatar details' : 'View details'}
                >
                  <Eye className="w-4 h-4" />
                  <span>View Details</span>
                </button>
              </>
            )}
          </div>
        </div>
        {deletingOverlay}
      </motion.div>
  );
}
