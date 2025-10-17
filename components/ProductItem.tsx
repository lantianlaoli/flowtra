'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, Plus, X, MoveRight } from 'lucide-react';
import { UserProduct, UserProductPhoto } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';

interface ProductItemProps {
  product: UserProduct;
  onEdit: (productId: string, newName: string) => void;
  onDelete: (productId: string) => void;
  onPhotoUpload: (productId: string, file: File) => void;
  onDeletePhoto: (productId: string, photoId: string) => void;
  onMoveToBrand?: (productId: string) => void;
  indented?: boolean; // Whether to show indentation (when under a brand)
}

export default function ProductItem({
  product,
  onEdit,
  onDelete,
  onPhotoUpload,
  onDeletePhoto,
  onMoveToBrand,
  indented = true
}: ProductItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<UserProductPhoto | null>(null);
  const photos = product.user_product_photos || [];

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    onDelete(product.id);
  };

  const handlePhotoDelete = (photo: UserProductPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoToDelete(photo);
  };

  const confirmPhotoDelete = () => {
    if (photoToDelete) {
      onDeletePhoto(product.id, photoToDelete.id);
    }
  };

  const handleStartEditing = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setEditingName(product.product_name);
  };

  const handleSaveEdit = async () => {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      setEditingName(product.product_name);
      setIsEditing(false);
      return;
    }

    setIsEditing(false);

    if (trimmedName !== product.product_name) {
      onEdit(product.id, trimmedName);
    }
  };

  const handleCancelEdit = () => {
    setEditingName(product.product_name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onPhotoUpload(product.id, file);
    }
    if (e.target) e.target.value = '';
  };

  return (
    <motion.div
      className={`
        bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200
        ${indented ? 'ml-4 md:ml-8' : ''}
      `}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="p-3 md:p-4">
        <div className="flex items-start gap-2 md:gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0">
            {photos.length > 0 ? (
              <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={photos[0].photo_url}
                  alt={product.product_name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 64px, 80px"
                />
                {photos.length > 1 && (
                  <div className="absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1 bg-black/60 text-white text-xs px-1 md:px-1.5 py-0.5 rounded">
                    +{photos.length - 1}
                  </div>
                )}
              </div>
            ) : (
              <label className="w-16 h-16 md:w-20 md:h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                />
                <Plus className="w-5 h-5 md:w-6 md:h-6 text-gray-400 group-hover:text-gray-600" />
              </label>
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleSaveEdit}
                onKeyDown={handleKeyDown}
                className="font-medium text-sm md:text-base text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-gray-900 focus:border-transparent w-full mb-1"
                autoFocus
                onFocus={(e) => e.target.select()}
                maxLength={100}
              />
            ) : (
              <h4
                className="font-medium text-sm md:text-base text-gray-900 cursor-pointer hover:text-gray-700 transition-colors mb-1"
                onClick={handleStartEditing}
              >
                {product.product_name}
              </h4>
            )}
            {product.description && (
              <p className="text-gray-600 text-xs md:text-sm line-clamp-2">
                {product.description}
              </p>
            )}

            {/* Photo Gallery (when there are photos) */}
            {photos.length > 0 && (
              <div className="flex gap-1.5 md:gap-2 mt-2 md:mt-3">
                {photos.slice(0, 3).map((photo) => (
                  <div key={photo.id} className="relative group w-10 h-10 md:w-12 md:h-12">
                    <Image
                      src={photo.photo_url}
                      alt={photo.file_name}
                      fill
                      className="object-cover rounded"
                      sizes="(max-width: 768px) 40px, 48px"
                    />
                    <button
                      onClick={(e) => handlePhotoDelete(photo, e)}
                      className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-2.5 h-2.5 md:w-3 md:h-3" />
                    </button>
                  </div>
                ))}
                {photos.length > 3 && (
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-600">+{photos.length - 3}</span>
                  </div>
                )}
                {photos.length < 6 && (
                  <label className="w-10 h-10 md:w-12 md:h-12 border-2 border-dashed border-gray-300 rounded flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 group-hover:text-gray-600" />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-start gap-1 md:gap-2">
            <button
              onClick={handleStartEditing}
              className="p-1.5 md:p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit name"
            >
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>

            {onMoveToBrand && (
              <button
                onClick={() => onMoveToBrand(product.id)}
                className="p-1.5 md:p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors hidden sm:block"
                title="Move to brand"
              >
                <MoveRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
            )}

            {/* Delete button - always visible on mobile, hover-based on desktop */}
            <button
              onClick={handleDelete}
              className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors sm:hidden"
              title="Delete product"
            >
              <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>

            <AnimatePresence>
              {isHovered && (
                <motion.button
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleDelete}
                  className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors hidden sm:block"
                  title="Delete product"
                >
                  <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Delete Product Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${product.product_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      {/* Delete Photo Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!photoToDelete}
        onClose={() => setPhotoToDelete(null)}
        onConfirm={confirmPhotoDelete}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </motion.div>
  );
}
