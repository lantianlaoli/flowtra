'use client';

import Image from 'next/image';
import { Eye, Loader2 } from 'lucide-react';
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

  return (
    <motion.div
        className={`
          assets-avatar-card relative bg-white rounded-xl border overflow-hidden transition-all duration-200
          ${isSelectableMode ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm' : 'hover:border-gray-300 hover:shadow-sm'}
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
        <div className="assets-avatar-card-media relative w-full aspect-square">
          <Image
            src={avatar.photo_url}
            alt={avatar.avatar_name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />

          {isDeleting && (
            <div className="assets-avatar-card-loading absolute inset-0 bg-white/80 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-gray-900 animate-spin" />
            </div>
          )}

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
                  className={`assets-avatar-card-action w-full min-h-[42px] inline-flex items-center justify-center gap-2 rounded-lg border border-black bg-black px-3 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25 ${isSystemAvatar ? 'opacity-40 cursor-not-allowed hover:bg-black' : ''}`}
                  title={isSystemAvatar ? 'System avatar' : 'View details'}
                  disabled={isSystemAvatar}
                >
                  <Eye className="w-4 h-4" />
                  <span>View Details</span>
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
  );
}
