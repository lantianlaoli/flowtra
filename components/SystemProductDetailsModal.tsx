'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, X } from 'lucide-react';
import type { UserProduct } from '@/lib/supabase';

interface SystemProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: UserProduct | null;
}

export default function SystemProductDetailsModal({
  isOpen,
  onClose,
  product,
}: SystemProductDetailsModalProps) {
  if (!product) return null;

  const photos = product.user_product_photos || [];
  const frontalPhoto =
    photos.find((photo) => photo.photo_role === 'frontal' || photo.is_primary) || photos[0];
  const referencePhotos = photos.filter((photo) => photo.id !== frontalPhoto?.id);

  const angleLabels = ['Left angle', 'Back angle', 'Right angle'];

  return (
    <AnimatePresence>
      {isOpen && (
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
                  Read-only system product
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{product.product_name}</h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="assets-modal-close inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
                aria-label="Close system product details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Sparkles className="h-4 w-4 text-gray-500" />
                  Frontal photo
                </div>
                <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-gray-200 bg-gray-50">
                  {frontalPhoto && (
                    <Image
                      src={frontalPhoto.photo_url}
                      alt={product.product_name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 60vw"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Sparkles className="h-4 w-4 text-gray-500" />
                  Reference angles
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {referencePhotos.map((photo, index) => (
                    <div key={`${photo.file_name}-${index}`} className="space-y-2">
                      <div className="relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                        <Image
                          src={photo.photo_url}
                          alt={`${product.product_name} reference ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 50vw, 20vw"
                        />
                      </div>
                      <p className="text-xs font-medium text-gray-500">
                        {angleLabels[index] || `Reference ${index + 1}`}
                      </p>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
