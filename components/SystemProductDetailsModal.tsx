'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lock, Sparkles, X } from 'lucide-react';
import type { UserProduct } from '@/lib/supabase';

interface SystemProductDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: UserProduct | null;
  embedded?: boolean;
}

export default function SystemProductDetailsModal({
  isOpen,
  onClose,
  product,
  embedded = false,
}: SystemProductDetailsModalProps) {
  if (!product) return null;

  const photos = product.user_product_photos || [];
  const frontalPhoto =
    photos.find((photo) => photo.photo_role === 'frontal' || photo.is_primary) || photos[0];
  const referencePhotos = photos.filter((photo) => photo.id !== frontalPhoto?.id);
  const angleLabels = ['Left angle', 'Back angle', 'Right angle'];

  const content = isOpen ? (
    <motion.div
      className={embedded
        ? 'relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-white'
        : 'relative z-10 w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl'}
      initial={{ opacity: 0, y: embedded ? 0 : 20, scale: embedded ? 1 : 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: embedded ? 0 : 12, scale: embedded ? 1 : 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <div className={`flex items-start justify-between gap-4 border-b border-gray-100 ${embedded ? 'px-5 py-3.5' : 'px-6 py-5'}`}>
        <div className="flex items-center gap-3">
          {embedded ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-xs font-semibold text-black hover:bg-gray-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          ) : null}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              <Lock className="h-3.5 w-3.5" />
              Read-only system product
            </div>
            <h2 className={`${embedded ? 'text-base' : 'text-2xl'} font-semibold text-gray-900`}>
              {product.product_name}
            </h2>
          </div>
        </div>

        {!embedded ? (
          <button
            type="button"
            onClick={onClose}
            className="assets-modal-close inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
            aria-label="Close system product details"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className={embedded
        ? 'grid min-h-0 flex-1 grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] gap-5 overflow-hidden px-5 py-4'
        : 'grid gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]'}
      >
        <div className={embedded ? 'flex min-h-0 flex-col gap-3' : 'space-y-3'}>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-gray-500" />
            Frontal photo
          </div>
          <div className={embedded
            ? 'relative min-h-0 flex-1 overflow-hidden rounded-3xl border border-gray-200 bg-gray-50'
            : 'relative aspect-[4/5] overflow-hidden rounded-3xl border border-gray-200 bg-gray-50'}
          >
            {frontalPhoto ? (
              <Image
                src={frontalPhoto.photo_url}
                alt={product.product_name}
                fill
                className={embedded ? 'object-contain p-3' : 'object-cover'}
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            ) : null}
          </div>
        </div>

        <div className={embedded ? 'flex min-h-0 flex-col gap-3' : 'space-y-5'}>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Sparkles className="h-4 w-4 text-gray-500" />
            Reference angles
          </div>
          <div className={embedded ? 'grid min-h-0 flex-1 grid-cols-3 gap-3' : 'grid grid-cols-2 gap-4'}>
            {referencePhotos.map((photo, index) => (
              <div key={`${photo.file_name}-${index}`} className="space-y-2">
                <div className={embedded
                  ? 'relative min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50'
                  : 'relative aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-50'}
                >
                  <Image
                    src={photo.photo_url}
                    alt={`${product.product_name} reference ${index + 1}`}
                    fill
                    className={embedded ? 'object-contain p-2.5' : 'object-cover'}
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
  ) : null;

  if (embedded) return content;

  return (
    <AnimatePresence>
      {content ? (
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
          {content}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
