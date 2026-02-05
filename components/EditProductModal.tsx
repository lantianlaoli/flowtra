'use client';

import { useState, useEffect } from 'react';
import { X, Package, Loader2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserProduct, UserProductPhoto } from '@/lib/supabase';
import ConfirmDialog from './ConfirmDialog';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';

interface EditProductModalProps {
  isOpen: boolean;
  product: UserProduct | null;
  onClose: () => void;
  onProductUpdated: (product: UserProduct) => void;
  onDelete: (productId: string) => void;
  onPhotoUpload: (productId: string, file: File, photoRole?: 'frontal' | 'reference') => Promise<void>;
  onDeletePhoto: (productId: string, photoId: string) => Promise<void>;
  isDeleting?: boolean;
}

export default function EditProductModal({
  isOpen,
  product,
  onClose,
  onProductUpdated,
  onDelete,
  onPhotoUpload,
  onDeletePhoto,
  isDeleting = false
}: EditProductModalProps) {
  const [productName, setProductName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoToDelete, setPhotoToDelete] = useState<UserProductPhoto | null>(null);
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      setProductName(product.product_name);
      setError(null);
      setUploadError(null);
      setSelectedPhotoIndex(0);
      setTimeout(() => {
        const input = document.querySelector('#edit-product-name-input') as HTMLInputElement;
        if (input) input.focus();
      }, 150);
    }
  }, [isOpen, product]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isUpdating) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isUpdating, onClose]);

  if (!product) return null;

  const allPhotos = product.user_product_photos || [];
  const frontalPhoto = allPhotos.find((photo) => photo.photo_role === 'frontal')
    || allPhotos.find((photo) => photo.is_primary)
    || allPhotos[0]
    || null;
  const referencePhotos = allPhotos.filter((photo) => photo.id !== frontalPhoto?.id);
  const orderedPhotos = frontalPhoto ? [frontalPhoto, ...referencePhotos] : allPhotos;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName.trim()) {
      setError('Product name is required');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const hasChanges = productName.trim() !== product.product_name;
      if (!hasChanges) return;

      const response = await fetch(`/api/user-products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_name: productName.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update product');
      }

      const data = await response.json();
      onProductUpdated(data.product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = (photoRole: 'frontal' | 'reference') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      setUploadError(validationResult.error);
      if (e.target) e.target.value = '';
      return;
    }

    try {
      setUploadError(null);
      if (photoRole === 'frontal' && frontalPhoto) {
        await onDeletePhoto(product.id, frontalPhoto.id);
      }
      await onPhotoUpload(product.id, file, photoRole);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!photoToDelete) return;
    try {
      await onDeletePhoto(product.id, photoToDelete.id);
      setPhotoToDelete(null);
      if (selectedPhotoIndex >= orderedPhotos.length - 1 && selectedPhotoIndex > 0) {
        setSelectedPhotoIndex(selectedPhotoIndex - 1);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to delete photo');
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="assets-modal assets-edit-product fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="assets-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.div
              className="assets-modal-panel assets-edit-product-panel relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-4xl mx-auto overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="assets-modal-header flex items-center justify-between p-5 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="assets-modal-icon w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="assets-modal-title text-lg font-semibold text-gray-900">Edit Product</h3>
                    <p className="assets-modal-subtitle text-sm text-gray-600">Manage name and product photos in one place.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="assets-modal-close w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                  disabled={isUpdating}
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
                <div className="border-r border-gray-200 bg-gray-50">
                  {orderedPhotos.length > 0 ? (
                    <div className="aspect-square relative">
                      <Image
                        src={orderedPhotos[selectedPhotoIndex].photo_url}
                        alt={product.product_name}
                        fill
                        className="object-contain"
                        sizes="(max-width: 1024px) 100vw, 60vw"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square flex items-center justify-center text-sm text-gray-400">No photo</div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                  <div>
                    <label htmlFor="edit-product-name-input" className="block text-sm font-medium text-gray-700 mb-2">
                      Product Name
                    </label>
                    <input
                      id="edit-product-name-input"
                      type="text"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      placeholder="Enter product name"
                      disabled={isUpdating}
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">Frontal Photo</p>
                    </div>
                    <p className="mb-2 text-xs text-gray-500">Use a clear front-facing product shot on clean background.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {frontalPhoto ? (
                        <div
                          className={`relative group aspect-square rounded-lg overflow-hidden cursor-pointer border ${orderedPhotos[selectedPhotoIndex]?.id === frontalPhoto.id ? 'border-gray-900' : 'border-gray-200'}`}
                          onClick={() => {
                            const index = orderedPhotos.findIndex((photo) => photo.id === frontalPhoto.id);
                            setSelectedPhotoIndex(index < 0 ? 0 : index);
                          }}
                        >
                          <Image src={frontalPhoto.photo_url} alt={frontalPhoto.file_name} fill className="object-cover" sizes="120px" />
                          <label
                            className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input type="file" accept={getAcceptedImageFormats()} onChange={handleFileUpload('frontal')} className="hidden" />
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Plus className="w-3 h-3" />
                              Replace
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPhotoToDelete(frontalPhoto);
                            }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
                          <input type="file" accept={getAcceptedImageFormats()} onChange={handleFileUpload('frontal')} className="hidden" />
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600"><Plus className="w-3 h-3" />Add</span>
                        </label>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-900">Reference Photos</p>
                    </div>
                    <p className="mb-2 text-xs text-gray-500">Recommended: one 45° front angle plus 1–2 detail shots (back/close-up/structure).</p>
                    <div className="grid grid-cols-3 gap-2">
                      {referencePhotos.map((photo) => (
                        <div
                          key={photo.id}
                          className={`relative group aspect-square rounded-lg overflow-hidden cursor-pointer border ${orderedPhotos[selectedPhotoIndex]?.id === photo.id ? 'border-gray-900' : 'border-gray-200'}`}
                          onClick={() => {
                            const index = orderedPhotos.findIndex((item) => item.id === photo.id);
                            setSelectedPhotoIndex(index < 0 ? 0 : index);
                          }}
                        >
                          <Image src={photo.photo_url} alt={photo.file_name} fill className="object-cover" sizes="120px" />
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPhotoToDelete(photo);
                            }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {referencePhotos.length < 3 && (
                        <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
                          <input type="file" accept={getAcceptedImageFormats()} onChange={handleFileUpload('reference')} className="hidden" />
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600"><Plus className="w-3 h-3" />Add</span>
                        </label>
                      )}
                    </div>
                  </div>

                  {(error || uploadError) && (
                    <p className="text-sm text-red-600">{renderErrorMessage(error || uploadError || '')}</p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDeleteProductDialog(true)}
                      className="flex-1 px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Product'}
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating || !productName.trim()}
                      className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isUpdating ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={showDeleteProductDialog}
        onClose={() => setShowDeleteProductDialog(false)}
        onConfirm={() => {
          onDelete(product.id);
          onClose();
        }}
        title="Delete Product"
        message={`Are you sure you want to delete "${product.product_name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!photoToDelete}
        onClose={() => setPhotoToDelete(null)}
        onConfirm={handleDeletePhoto}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
