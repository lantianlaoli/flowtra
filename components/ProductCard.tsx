'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Eye, Edit2, Pencil, Trash2, Plus, X, Loader2 } from 'lucide-react';
import { UserProduct, UserProductPhoto } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';

interface ProductCardProps {
  product: UserProduct;
  // Quick edit mode (inline name editing)
  onEdit?: (productId: string, newName: string) => void;
  // Full edit mode (open modal with product object)
  onEditClick?: (product: UserProduct) => void;
  onDelete: (productId: string) => void;
  onPhotoUpload?: (productId: string, file: File, photoRole?: 'frontal' | 'reference') => void;
  onDeletePhoto?: (productId: string, photoId: string) => void;
  // View/select modes
  onView?: (product: UserProduct) => void;
  onSelect?: (product: UserProduct) => void;
  isSelected?: boolean;
  isDeleting?: boolean;
  // Display modes
  mode?: 'full' | 'compact' | 'selectable' | 'list';
}

export default function ProductCard({
  product,
  onEdit,
  onEditClick,
  onDelete,
  onPhotoUpload,
  onDeletePhoto,
  onView,
  onSelect,
  isSelected = false,
  isDeleting = false,
  mode = 'full'
}: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photos = product.user_product_photos || [];
  const frontalPhoto = photos.find((photo) => photo.photo_role === 'frontal')
    || photos.find((photo) => photo.is_primary)
    || photos[0];

  const isCompactMode = mode === 'compact';
  const isSelectableMode = mode === 'selectable';
  const isFullMode = mode === 'full';
  const isListMode = mode === 'list';
  const isSystemProduct = Boolean(product.isSystem);

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

  // Click handlers
  const handleCardClick = () => {
    if (isSelectableMode && onSelect) {
      onSelect(product);
    } else if (isCompactMode && onView) {
      onView(product);
    } else if (isCompactMode && onEditClick) {
      onEditClick(product);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompactMode && onView) {
      onView(product);
      return;
    }
    if (onEditClick) {
      onEditClick(product);
    } else if (isFullMode) {
      setIsEditing(true);
      setEditingName(product.product_name);
    }
  };

  const handleDelete = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isSystemProduct) return;
    if (isDeleting) return;
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

    // Validate image dimensions before uploading
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Check minimum dimensions (300x300)
      if (img.width < 300 || img.height < 300) {
        setPhotoError(`Image too small. Minimum size is 300x300px. Your image is ${img.width}x${img.height}px.`);
        if (e.target) e.target.value = '';
        return;
      }

      // Image passes all validations - proceed with upload
      if (onPhotoUpload) {
        setPhotoError(null);
        const hasFrontal = photos.some((photo) => photo.photo_role === 'frontal' || photo.is_primary);
        onPhotoUpload(product.id, file, hasFrontal ? 'reference' : 'frontal');
      }
      if (e.target) e.target.value = '';
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setPhotoError('Failed to load image. Please try a different file.');
      if (e.target) e.target.value = '';
    };

    img.src = objectUrl;
  };

  // Compact mode rendering
  if (isCompactMode) {
    return (
      <>
        <motion.div
          className="assets-product-card assets-product-card--compact relative flex h-full flex-col bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-200 cursor-pointer hover:border-gray-300 hover:shadow-sm"
          onClick={handleCardClick}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 1, scale: 0.95 }}
          whileHover={isDeleting ? undefined : { y: -2 }}
        >
          {/* Product Photo */}
          <div className="assets-product-card-media relative h-36 min-h-36 w-full overflow-hidden bg-gray-100 sm:h-40 sm:min-h-40">
            {frontalPhoto ? (
              <Image
                src={frontalPhoto.photo_url}
                alt={product.product_name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            ) : (
              <div className="assets-product-card-empty w-full h-full flex items-center justify-center text-gray-400">
                <span className="text-sm">No photo</span>
              </div>
            )}
          </div>

          {/* Product Info and Actions */}
          <div className="assets-product-card-body flex flex-col gap-2 p-3">
            {/* Product Name */}
            <h4 className="assets-product-card-title line-clamp-2 text-sm font-medium leading-tight text-gray-900">
              {product.product_name}
            </h4>

            <div className="flex items-center gap-2">
              <button
                onClick={handleEditClick}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-black bg-black px-3 text-xs font-semibold text-white transition hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25"
                title={isSystemProduct ? 'View system product details' : 'Edit'}
                aria-label="Edit product"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDelete(e); }}
                disabled={isSystemProduct || isDeleting}
                className="inline-flex h-9 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={isSystemProduct ? 'System product cannot be deleted' : 'Delete product'}
                title={isSystemProduct ? 'System product cannot be deleted' : 'Delete product'}
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <AnimatePresence>{deletingOverlay}</AnimatePresence>
        </motion.div>

      </>
    );
  }

  // List mode rendering
  if (isListMode) {
    return (
      <>
        <motion.div
          className="assets-product-card assets-product-card--list bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer group"
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          onClick={handleCardClick}
        whileHover={isDeleting ? undefined : { y: -1 }}
        >
          <div className="assets-product-card-row flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4">
            {/* Product Photo (left side on desktop, top on mobile) */}
            <div className="assets-product-card-media relative h-40 min-h-40 w-full flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-20 sm:min-h-20 sm:w-20">
              {photos.length > 0 ? (
                <Image
                  src={photos[0].photo_url}
                  alt={product.product_name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 80px"
                />
            ) : (
              <div className="assets-product-card-empty w-full h-full flex items-center justify-center text-gray-400">
                <span className="text-xs">No photo</span>
              </div>
            )}
          </div>

            {/* Product Info (center, takes remaining space) */}
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <h4 className="assets-product-card-title font-medium text-base text-gray-900 truncate mb-1">
                {product.product_name}
              </h4>
            </div>

            {/* Action Buttons (right side on desktop, bottom on mobile) */}
            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
              {!isSystemProduct && (
                <button
                  onClick={handleEditClick}
                  className="assets-product-card-action p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors"
                  title="Edit product"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}

              <AnimatePresence>
                {!isSystemProduct && (isHovered || isDeleting) && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="assets-product-card-action p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
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
            </div>
          </div>
        </motion.div>

      </>
    );
  }

  // Full mode or selectable mode rendering (existing layout)
  return (
    <>
      <motion.div
        className={`
          assets-product-card assets-product-card--full relative bg-white rounded-xl border-2 transition-all duration-200 cursor-pointer
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
        whileHover={isDeleting ? undefined : { y: -2 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="assets-product-card-header p-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={handleKeyDown}
                  className="assets-product-card-input font-semibold text-gray-900 text-lg mb-1 bg-white border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-gray-900 focus:border-transparent w-full"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  maxLength={100}
                />
              ) : (
                <h3
                  className="assets-product-card-title font-semibold text-gray-900 text-lg mb-1 cursor-pointer hover:text-gray-700 transition-colors"
                  onClick={isFullMode && !isSystemProduct ? handleEditClick : undefined}
                >
                  {product.product_name}
                </h3>
              )}

            </div>

            {!isSelectableMode && !isSystemProduct && (
              <div className="flex gap-2 ml-3">
                <button
                  onClick={handleEditClick}
                  className="assets-product-card-action flex items-center gap-1 px-3 py-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
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
                        className="assets-product-card-action assets-product-card-danger p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="assets-product-card-body p-4">
          <div className="assets-product-card-grid grid grid-cols-3 gap-2">
            {(frontalPhoto ? [frontalPhoto, ...photos.filter((photo) => photo.id !== frontalPhoto.id)] : photos).slice(0, 5).map((photo) => (
              <div key={photo.id} className="assets-product-card-thumb relative h-24 min-h-24 w-full overflow-hidden rounded-lg sm:h-28 sm:min-h-28">
                <Image
                  src={photo.photo_url}
                  alt={photo.file_name}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 33vw, 20vw"
                />
                {!isSelectableMode && !isSystemProduct && onDeletePhoto && (
                  <button
                    onClick={(e) => handlePhotoDelete(photo, e)}
                    className="assets-product-card-thumb-remove absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Photo Button */}
            {!isSelectableMode && !isSystemProduct && onPhotoUpload && photos.length < 4 && (
              <label className="assets-product-card-add flex h-24 min-h-24 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-gray-400 hover:bg-gray-50 group sm:h-28 sm:min-h-28">
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
              <div className="assets-product-card-more flex h-24 min-h-24 w-full items-center justify-center rounded-lg bg-gray-100 sm:h-28 sm:min-h-28">
                <span className="text-sm font-medium text-gray-600">
                  +{photos.length - 5}
                </span>
              </div>
            )}
          </div>

          {photos.length === 0 && !isSelectableMode && !isSystemProduct && onPhotoUpload && (
            <div className="assets-product-card-grid grid grid-cols-3 gap-2">
              <label className="assets-product-card-add flex h-24 min-h-24 w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-gray-400 hover:bg-gray-50 group sm:h-28 sm:min-h-28">
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
            <p className="assets-product-card-error mt-2 text-sm text-red-600">
              {renderErrorMessage(photoError)}
            </p>
          )}

          {photos.length === 0 && isSelectableMode && (
            <div className="assets-product-card-empty text-center py-6 text-gray-400">
              <div className="w-10 h-10 mx-auto mb-2 bg-gray-100 rounded-lg flex items-center justify-center">
                <Plus className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-xs">No photos</p>
            </div>
          )}
        </div>
        <AnimatePresence>{deletingOverlay}</AnimatePresence>
      </motion.div>
    </>
  );
}
