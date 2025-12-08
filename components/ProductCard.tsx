'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, Plus, X, Loader2 } from 'lucide-react';
import { UserProduct, UserProductPhoto } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmDialog from './ConfirmDialog';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';

interface ProductCardProps {
  product: UserProduct;
  // Quick edit mode (inline name editing)
  onEdit?: (productId: string, newName: string) => void;
  // Full edit mode (open modal with product object)
  onEditClick?: (product: UserProduct) => void;
  onDelete: (productId: string) => void;
  onPhotoUpload?: (productId: string, file: File) => void;
  onDeletePhoto?: (productId: string, photoId: string) => void;
  // View/select modes
  onView?: (product: UserProduct) => void;
  onSelect?: (product: UserProduct) => void;
  isSelected?: boolean;
  isDeleting?: boolean;
  // Display modes
  mode?: 'full' | 'compact' | 'selectable';
}

export default function ProductCard({
  product,
  onEdit,
  onEditClick,
  onDelete,
  onPhotoUpload,
  onDeletePhoto,
  // onView - intentionally not destructured as it's not used in this component
  onSelect,
  isSelected = false,
  isDeleting = false,
  mode = 'full'
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photos = product.user_product_photos || [];

  const isCompactMode = mode === 'compact';
  const isSelectableMode = mode === 'selectable';
  const isFullMode = mode === 'full';

  // Click handlers
  const handleCardClick = () => {
    if (isSelectableMode && onSelect) {
      onSelect(product);
    } else if (isCompactMode && onEditClick) {
      onEditClick(product);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditClick) {
      onEditClick(product);
    } else if (isFullMode) {
      setIsEditing(true);
      setEditingName(product.product_name);
    }
  };

  const handleDelete = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isDeleting) return;
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    onDelete(product.id);
  };

  const handlePhotoDelete = (photo: UserProductPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeletePhoto && confirm('Are you sure you want to delete this photo?')) {
      onDeletePhoto(product.id, photo.id);
    }
  };

  const handleSaveEdit = async () => {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      setEditingName(product.product_name);
      setIsEditing(false);
      return;
    }

    setIsEditing(false);

    if (trimmedName !== product.product_name && onEdit) {
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

  useEffect(() => {
    setPhotoError(null);
  }, [product.id]);

  const renderErrorMessage = (message: string) => {
    if (!message.includes(IMAGE_CONVERSION_LINK)) {
      return message;
    }
    const [before, after] = message.split(IMAGE_CONVERSION_LINK);
    return (
      <>
        {before}
        <a
          href={IMAGE_CONVERSION_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-red-800"
        >
          {IMAGE_CONVERSION_LINK}
        </a>
        {after}
      </>
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      setPhotoError(validationResult.error);
      if (e.target) e.target.value = '';
      return;
    }

    if (onPhotoUpload) {
      setPhotoError(null);
      onPhotoUpload(product.id, file);
    }
    if (e.target) e.target.value = '';
  };

  // Compact mode rendering
  if (isCompactMode) {
    return (
      <>
        <motion.div
          className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          onClick={handleCardClick}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          whileHover={{ y: -4 }}
        >
          {/* Product Photo */}
          <div className="relative w-full aspect-square bg-gray-100">
            {photos.length > 0 ? (
              <>
                <Image
                  src={photos[0].photo_url}
                  alt={product.product_name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                {photos.length > 1 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                    +{photos.length - 1}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <span className="text-sm">No photo</span>
              </div>
            )}
          </div>

          {/* Product Info and Actions */}
          <div className="p-3">
            {/* Product Name */}
            <h4 className="font-medium text-sm text-gray-900 line-clamp-2 mb-2 min-h-[2.5rem]">
              {product.product_name}
            </h4>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={handleEditClick}
                className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit product"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              {/* Desktop: Show on hover */}
              <AnimatePresence>
                {(isHovered || isDeleting) && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors hidden sm:flex disabled:opacity-50 disabled:cursor-not-allowed"
                    title={isDeleting ? "Deleting..." : "Delete product"}
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Mobile: Always show */}
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors sm:hidden disabled:opacity-50 disabled:cursor-not-allowed"
                title={isDeleting ? "Deleting..." : "Delete product"}
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={confirmDelete}
          title="Delete Product"
          message={`Are you sure you want to delete "${product.product_name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
        />
      </>
    );
  }

  // Full mode or selectable mode rendering (existing layout)
  return (
    <>
      <motion.div
        className={`
          bg-white rounded-xl border-2 transition-all duration-200 cursor-pointer
          ${isSelectableMode
            ? isSelected
              ? 'border-gray-900 shadow-lg ring-2 ring-gray-200'
              : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
            : 'border-gray-200 hover:shadow-md'
          }
        `}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={handleCardClick}
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={handleKeyDown}
                  className="font-semibold text-gray-900 text-lg mb-1 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-gray-900 focus:border-transparent w-full"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  maxLength={100}
                />
              ) : (
                <h3
                  className="font-semibold text-gray-900 text-lg mb-1 cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={isFullMode ? handleEditClick : undefined}
                >
                  {product.product_name}
                </h3>
              )}
              {product.description && (
                <p className="text-gray-600 text-sm line-clamp-2">
                  {product.description}
                </p>
              )}
            </div>

            {!isSelectableMode && (
              <div className="flex gap-2 ml-3">
                <button
                  onClick={handleEditClick}
                  className="flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit Name</span>
                </button>
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.15 }}
                    >
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Photos Grid */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 5).map((photo) => (
              <div key={photo.id} className="relative group aspect-square">
                <Image
                  src={photo.photo_url}
                  alt={photo.file_name}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 33vw, 20vw"
                />
                {!isSelectableMode && onDeletePhoto && (
                  <button
                    onClick={(e) => handlePhotoDelete(photo, e)}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Photo Button */}
            {!isSelectableMode && onPhotoUpload && photos.length < 6 && (
              <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors group cursor-pointer">
                <input
                  type="file"
                  accept={getAcceptedImageFormats()}
                  onChange={handleFileUpload}
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                />
                <Plus className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
              </label>
            )}

            {/* Show more indicator */}
            {photos.length > 5 && (
              <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">
                  +{photos.length - 5}
                </span>
              </div>
            )}
          </div>

          {photos.length === 0 && !isSelectableMode && onPhotoUpload && (
            <div className="grid grid-cols-3 gap-2">
              <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors group cursor-pointer">
                <input
                  type="file"
                  accept={getAcceptedImageFormats()}
                  onChange={handleFileUpload}
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                />
                <Plus className="w-6 h-6 text-gray-400 group-hover:text-gray-600" />
              </label>
            </div>
          )}

          {photoError && (
            <p className="mt-2 text-sm text-red-600">
              {renderErrorMessage(photoError)}
            </p>
          )}

          {photos.length === 0 && isSelectableMode && (
            <div className="text-center py-6 text-gray-400">
              <div className="w-10 h-10 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center">
                <Plus className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-xs">No photos</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Product"
        message={`Are you sure you want to delete "${product.product_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
