'use client';

import { useState, useEffect } from 'react';
import { X, Edit2, Trash2, Plus, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { UserProduct, UserProductPhoto } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: UserProduct | null;
  onEdit: (product: UserProduct) => void;
  onDelete: (productId: string) => void;
  onPhotoUpload: (productId: string, file: File) => void;
  onDeletePhoto: (productId: string, photoId: string) => void;
  isDeleting?: boolean;
}

export default function ProductDetailModal({
  isOpen,
  onClose,
  product,
  onEdit,
  onDelete,
  onPhotoUpload,
  onDeletePhoto,
  isDeleting = false
}: ProductDetailModalProps) {
  const [photoToDelete, setPhotoToDelete] = useState<UserProductPhoto | null>(null);
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset selected photo when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPhotoIndex(0);
    }
  }, [isOpen]);

  if (!product) return null;

  const photos = product.user_product_photos || [];

  const handleEdit = () => {
    onEdit(product);
    onClose();
  };

  const handleDelete = () => {
    setShowDeleteProductDialog(true);
  };

  const confirmDeleteProduct = () => {
    onDelete(product.id);
    onClose();
  };

  const handlePhotoDelete = (photo: UserProductPhoto) => {
    setPhotoToDelete(photo);
  };

  const confirmPhotoDelete = () => {
    if (photoToDelete) {
      onDeletePhoto(product.id, photoToDelete.id);
      setPhotoToDelete(null);
      // Adjust selected photo index if needed
      if (selectedPhotoIndex >= photos.length - 1 && selectedPhotoIndex > 0) {
        setSelectedPhotoIndex(selectedPhotoIndex - 1);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onPhotoUpload(product.id, file);
    }
    if (e.target) e.target.value = '';
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={handleBackdropClick}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Modal Card */}
            <motion.div
              className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-4xl mx-auto overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b border-gray-200">
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {product.product_name}
                  </h2>
                  {(product.product_details || product.description) && (
                    <p className="mt-2 text-gray-600">
                      {product.product_details || product.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Main Photo Display */}
              {photos.length > 0 && (
                <div className="relative bg-gray-50">
                  <div className="aspect-video relative">
                    <Image
                      src={photos[selectedPhotoIndex].photo_url}
                      alt={product.product_name}
                      fill
                      className="object-contain"
                      sizes="(max-width: 896px) 100vw, 896px"
                    />
                  </div>

                  {/* Photo navigation */}
                  {photos.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
                      {photos.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedPhotoIndex(index)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === selectedPhotoIndex
                              ? 'bg-white w-6'
                              : 'bg-white/60 hover:bg-white/80'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Photo Thumbnails */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900">
                    Photos ({photos.length}/6)
                  </h3>
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {photos.map((photo, index) => (
                    <div
                      key={photo.id}
                      className={`relative group aspect-square cursor-pointer rounded-lg overflow-hidden ${
                        index === selectedPhotoIndex ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedPhotoIndex(index)}
                    >
                      <Image
                        src={photo.photo_url}
                        alt={photo.file_name}
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePhotoDelete(photo);
                        }}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Add Photo Button */}
                  {photos.length < 6 && (
                    <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Plus className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
                    </label>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 p-6 bg-gray-50">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {isDeleting ? 'Deleting...' : 'Delete Product'}
                </button>
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Product Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteProductDialog}
        onClose={() => setShowDeleteProductDialog(false)}
        onConfirm={confirmDeleteProduct}
        title="Delete Product"
        message={`Are you sure you want to delete "${product.product_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Delete Photo Confirmation */}
      <ConfirmDialog
        isOpen={!!photoToDelete}
        onClose={() => setPhotoToDelete(null)}
        onConfirm={confirmPhotoDelete}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
