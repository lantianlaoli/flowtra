'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, X } from 'lucide-react';
import type { SystemAvatar } from '@/lib/default-avatars';

interface SystemAvatarDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  avatar: SystemAvatar | null;
}

export default function SystemAvatarDetailsModal({
  isOpen,
  onClose,
  avatar,
}: SystemAvatarDetailsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && avatar ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                  <Lock className="h-3.5 w-3.5" />
                  Read-only system avatar
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{avatar.avatar_name}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Built-in avatar with multiple reference angles. Available in clone workflows, including Kling 3.0.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="assets-modal-close inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                aria-label="Close system avatar details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Sparkles className="h-4 w-4 text-gray-500" />
                  Primary photo
                </div>
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-gray-200 bg-gray-50">
                  <Image
                    src={avatar.primary_photo_url || avatar.photo_url}
                    alt={avatar.avatar_name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                  />
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Reference angles</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    These extra views are passed as supporting character references for compatible clone models.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {avatar.reference_photos.map((photo, index) => (
                    <div key={`${photo.file_name}-${index}`} className="space-y-2">
                      <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                        <Image
                          src={photo.photo_url}
                          alt={`${avatar.avatar_name} reference ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 50vw, 20vw"
                        />
                      </div>
                      <p className="text-xs font-medium text-gray-500">
                        {index === 0 ? 'Left angle' : 'Back angle'}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Built-in and protected</p>
                  <p className="mt-1 text-sm text-gray-600">
                    This avatar is provided by Flowtra. You can use it in generation and clone workflows, but it cannot be renamed, edited, or deleted.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
