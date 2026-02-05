'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { AlertCircle, Loader2, Package, Upload, X } from 'lucide-react';
import { UserProduct, UserProductPhoto } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: UserProduct) => void;
  preselectedBrandId?: string | null;
}

interface PreviewFile {
  file: File;
  preview: string;
}

export default function CreateProductModal({
  isOpen,
  onClose,
  onProductCreated,
  preselectedBrandId = null
}: CreateProductModalProps) {
  const [productName, setProductName] = useState('');
  const [frontalImage, setFrontalImage] = useState<PreviewFile | null>(null);
  const [referenceImages, setReferenceImages] = useState<PreviewFile[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const frontalInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProductName('');
      setFrontalImage(null);
      setReferenceImages([]);
      setFormError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const validateAndLoadImage = async (file: File): Promise<string> => {
    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      throw new Error(validationResult.error);
    }

    const objectUrl = URL.createObjectURL(file);

    try {
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = document.createElement('img');
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => reject(new Error('Failed to load image. Please try a different file.'));
        img.src = objectUrl;
      });

      if (dimensions.width < 300 || dimensions.height < 300) {
        throw new Error(`Image too small. Minimum size is 300x300px. Your image is ${dimensions.width}x${dimensions.height}px.`);
      }

      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file. Please try again.'));
        reader.readAsDataURL(file);
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleFrontalUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const preview = await validateAndLoadImage(file);
      setFrontalImage({ file, preview });
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to load image.');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (referenceImages.length >= 3) {
      setFormError('You can upload up to 3 reference images.');
      if (event.target) event.target.value = '';
      return;
    }

    try {
      const preview = await validateAndLoadImage(file);
      setReferenceImages((prev) => [...prev, { file, preview }]);
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to load image.');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

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

  const uploadPhoto = async (productId: string, file: File, photoRole: 'frontal' | 'reference') => {
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    uploadForm.append('photo_role', photoRole);

    const response = await fetch(`/api/user-products/${productId}/photos`, {
      method: 'POST',
      body: uploadForm
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.photo) {
      throw new Error(payload?.error || payload?.details || `Failed to upload ${photoRole} image`);
    }

    return payload.photo as UserProductPhoto;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!frontalImage) {
      setFormError('Upload one frontal product image to continue.');
      return;
    }

    if (!productName.trim()) {
      setFormError('Product name is required.');
      return;
    }

    setIsCreating(true);
    setFormError(null);

    try {
      const response = await fetch('/api/user-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productName.trim(),
          brand_id: preselectedBrandId
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.product) {
        const message = payload?.details || payload?.error || `Failed to create product (${response.status})`;
        throw new Error(message);
      }

      const newProduct = payload.product as UserProduct;
      setIsUploading(true);

      try {
        const uploadedPhotos: UserProductPhoto[] = [];

        const frontalPhoto = await uploadPhoto(newProduct.id, frontalImage.file, 'frontal');
        uploadedPhotos.push(frontalPhoto);

        for (const referenceImage of referenceImages) {
          const referencePhoto = await uploadPhoto(newProduct.id, referenceImage.file, 'reference');
          uploadedPhotos.push(referencePhoto);
        }

        newProduct.user_product_photos = uploadedPhotos;
      } catch (photoError) {
        await fetch(`/api/user-products/${newProduct.id}`, { method: 'DELETE' }).catch(() => null);
        throw photoError;
      } finally {
        setIsUploading(false);
      }

      onProductCreated(newProduct);
      onClose();
    } catch (error) {
      console.error('Error creating product:', error);
      setFormError(error instanceof Error ? error.message : 'Failed to create product. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const canSubmit = Boolean(
    frontalImage && productName.trim() && !isCreating && !isUploading
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="assets-modal assets-create-product fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="assets-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="assets-modal-panel assets-create-product-panel relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="assets-modal-header flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="assets-modal-icon flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="assets-modal-title text-xl font-semibold text-gray-900">Create New Product</p>
                  <p className="assets-modal-subtitle text-sm text-gray-600">Add 1 frontal image and up to 3 reference images.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="assets-modal-close flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                disabled={isCreating}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="assets-modal-body space-y-5 px-6 py-6">
              {formError && (
                <div className="assets-modal-error flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>{renderErrorMessage(formError)}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="product-name-input" className="assets-modal-label text-sm font-medium text-gray-700">
                    Product Name
                  </label>
                  <input
                    id="product-name-input"
                    type="text"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    className="assets-modal-input mt-2 w-full rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm text-gray-900 transition-all focus:border-black focus:bg-white focus:outline-none focus:ring-0"
                    placeholder="Enter product name"
                    maxLength={100}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">Frontal Image (Required)</p>
                      <span className="text-xs text-gray-500">Left panel</span>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => frontalInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          frontalInputRef.current?.click();
                        }
                      }}
                      className={cn(
                        'assets-modal-upload relative w-full aspect-[4/5] max-h-[560px] overflow-hidden rounded-2xl border-2 border-dashed transition',
                        frontalImage
                          ? 'border-gray-300 bg-[#F8F8F8]'
                          : 'border-gray-300 bg-[#FAFAFA] hover:border-gray-400'
                      )}
                    >
                      <div className="absolute left-3 top-3">
                        <span className="assets-modal-chip rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          Frontal
                        </span>
                      </div>

                      {frontalImage ? (
                        <>
                          <Image src={frontalImage.preview} alt="Frontal preview" fill className="object-cover" />
                          <button
                            type="button"
                            className="assets-modal-chip-close absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFrontalImage(null);
                            }}
                            disabled={isCreating}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div className="assets-modal-upload-empty flex h-full flex-col items-center justify-center px-6 text-center text-sm text-gray-600">
                          <Upload className="mb-3 h-7 w-7 text-gray-400" />
                          <div className="w-full max-w-[300px]">
                            <p className="assets-modal-upload-title text-base font-semibold text-gray-900 leading-6">
                              Upload the frontal product image
                            </p>
                            <p className="assets-modal-helper mt-2 text-xs text-gray-500 leading-5">
                              PNG or JPG, up to 8MB. Minimum size 300x300.
                            </p>
                          </div>
                        </div>
                      )}

                      <input
                        ref={frontalInputRef}
                        type="file"
                        accept={getAcceptedImageFormats()}
                        className="hidden"
                        onChange={handleFrontalUpload}
                        disabled={isCreating}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">Reference Images (Optional)</p>
                      <span className="text-xs text-gray-500">{referenceImages.length}/3</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {referenceImages.map((reference, index) => (
                        <div key={`reference-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                          <Image
                            src={reference.preview}
                            alt={`Reference ${index + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 45vw, 220px"
                          />
                          <button
                            type="button"
                            onClick={() => removeReferenceImage(index)}
                            className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                            disabled={isCreating}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      {referenceImages.length < 3 && (
                        <button
                          type="button"
                          onClick={() => referenceInputRef.current?.click()}
                          className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-[#FAFAFA] text-gray-500 transition hover:border-gray-400"
                        >
                          <Upload className="mb-2 h-5 w-5" />
                          <span className="text-xs font-medium">Add reference</span>
                        </button>
                      )}
                    </div>

                    <input
                      ref={referenceInputRef}
                      type="file"
                      accept={getAcceptedImageFormats()}
                      className="hidden"
                      onChange={handleReferenceUpload}
                      disabled={isCreating}
                    />

                    <p className="assets-modal-helper text-xs text-gray-500">
                      Recommendation: upload one 45° front-angle shot and up to two extra detail shots for function or structure (such as back view or close-up).
                    </p>
                  </div>
                </div>
              </div>

              <div className="assets-modal-actions flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="assets-modal-secondary flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="assets-modal-primary flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
                >
                  {(isCreating || isUploading) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCreating ? (isUploading ? 'Uploading images…' : 'Creating…') : 'Save Product'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
