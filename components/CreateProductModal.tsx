'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { AlertCircle, Loader2, Package, Upload, X } from 'lucide-react';
import { UserProduct } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';
import { useImageCompression } from '@/hooks/useImageCompression';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: UserProduct) => void;
  preselectedBrandId?: string | null;
}

type AnalysisState = 'idle' | 'analyzing' | 'completed' | 'failed';

const STATUS_COPY: Record<AnalysisState, { label: string; badge: string; helper: string }> = {
  idle: {
    label: 'Waiting for photo',
    badge: 'bg-gray-200 text-gray-700',
    helper: ''
  },
  analyzing: {
    label: 'Analyzing photo…',
    badge: 'bg-blue-100 text-blue-800',
    helper: ''
  },
  completed: {
    label: 'Name ready',
    badge: 'bg-emerald-100 text-emerald-800',
    helper: ''
  },
  failed: {
    label: 'Processing failed',
    badge: 'bg-red-100 text-red-800',
    helper: ''
  }
};

export default function CreateProductModal({
  isOpen,
  onClose,
  onProductCreated,
  preselectedBrandId = null
}: CreateProductModalProps) {
  const [productName, setProductName] = useState('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisState>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Image compression hook
  const { compressImage, isCompressing, compressionProgress } = useImageCompression();

  useEffect(() => {
    if (isOpen) {
      setProductName('');
      setUploadedImage(null);
      setImagePreview(null);
      setAnalysisStatus('idle');
      setAnalysisError(null);
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

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      setFormError(validationResult.error);
      if (event.target) event.target.value = '';
      return;
    }

    // Validate image dimensions before uploading
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Check minimum dimensions (300x300)
      if (img.width < 300 || img.height < 300) {
        setFormError(`Image too small. Minimum size is 300x300px. Your image is ${img.width}x${img.height}px.`);
        if (event.target) event.target.value = '';
        return;
      }

      // Image passes all validations - proceed with upload
      setFormError(null);
      setAnalysisError(null);
      setUploadedImage(file);
      setAnalysisStatus('analyzing');

      // Show original preview while analyzing
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);

      // Start analysis workflow
      analyzePhoto(file);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setFormError('Failed to load image. Please try a different file.');
      if (event.target) event.target.value = '';
    };

    img.src = objectUrl;
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

  const analyzePhoto = async (file: File) => {
    try {
      let fileToAnalyze = file;
      const fileSizeMB = file.size / 1024 / 1024;

      if (fileSizeMB > 4) {
        console.log(`[product-analysis] File size ${fileSizeMB.toFixed(2)}MB exceeds 4MB, compressing...`);
        const compressionResult = await compressImage(file);
        fileToAnalyze = compressionResult.compressedFile;
      }

      const formData = new FormData();
      formData.append('file', fileToAnalyze);

      const response = await fetch('/api/user-products/analyze', {
        method: 'POST',
        body: formData
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.productName) {
        const message = payload?.error || payload?.details || 'Failed to analyze product photo';
        throw new Error(message);
      }

      setProductName(payload.productName.slice(0, 100));
      setAnalysisStatus('completed');
    } catch (error) {
      console.error('Product analysis failed:', error);
      setAnalysisStatus('failed');
      setAnalysisError(error instanceof Error ? error.message : 'Failed to analyze product photo');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!uploadedImage) {
      setFormError('Upload a product photo to continue.');
      return;
    }

    if (analysisStatus !== 'completed') {
      setFormError('Wait for the AI analysis to finish before saving.');
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
        console.log('[submit] Uploading original image file');
        const uploadForm = new FormData();
        uploadForm.append('file', uploadedImage);
        uploadForm.append('is_primary', 'true');

        const photoResponse = await fetch(`/api/user-products/${newProduct.id}/photos`, {
          method: 'POST',
          body: uploadForm
        });

        const photoPayload = await photoResponse.json().catch(() => ({}));
        if (!photoResponse.ok || !photoPayload?.photo) {
          console.error('Product photo upload failed:', {
            status: photoResponse.status,
            payload: photoPayload
          });
          throw new Error(photoPayload?.error || photoPayload?.details || 'Failed to upload product photo');
        }

        newProduct.user_product_photos = [photoPayload.photo];
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
    uploadedImage && analysisStatus === 'completed' && productName.trim() && !isCreating && !isUploading
  );
  const statusMeta = STATUS_COPY[analysisStatus];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-gray-900">Create New Product</p>
                  <p className="text-sm text-gray-600">Upload a product photo and Flowtra will write the listing for you.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                disabled={isCreating}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
              {formError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>{renderErrorMessage(formError)}</span>
                </div>
              )}

              <div className="space-y-4">
                {analysisStatus === 'completed' && productName && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Product Name</p>
                    <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900">
                      {productName}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    className={cn(
                      "relative aspect-[9/16] h-[60vh] max-h-[560px] w-auto max-w-full mx-auto overflow-hidden rounded-2xl border-2 border-dashed transition",
                      imagePreview
                        ? "border-gray-200 bg-gray-900/5"
                        : "border-gray-300 bg-gray-50 hover:border-gray-400"
                    )}
                  >
                    <div className="absolute left-3 top-3">
                      <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusMeta.badge)}>
                        {statusMeta.label}
                      </span>
                    </div>

                    {imagePreview ? (
                      <>
                        <Image src={imagePreview} alt="Product preview" fill className="object-cover" />
                        <button
                          type="button"
                          className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                          onClick={() => {
                            setUploadedImage(null);
                            setImagePreview(null);
                            setAnalysisStatus('idle');
                            setAnalysisError(null);
                            setProductName('');
                          }}
                          disabled={isCreating}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-gray-600">
                        <Upload className="mb-3 h-6 w-6 text-gray-400" />
                        <div className="w-full max-w-[280px]">
                          <p className="font-semibold text-gray-900 leading-5">
                            Drop a product photo or click to browse
                          </p>
                          <p className="mt-2 text-xs text-gray-500 leading-5">
                            PNG or JPG, up to 8MB. Auto-compressed for upload if needed.
                          </p>
                        </div>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={getAcceptedImageFormats()}
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isCreating}
                    />

                    {(analysisStatus === 'analyzing' || isCompressing) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                        <div className="text-center">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-700 mx-auto mb-2" />
                          <p className="text-xs text-gray-600">
                            {isCompressing
                              ? `Compressing${compressionProgress ? ` ${compressionProgress}%` : ''}...`
                              : 'Analyzing...'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {statusMeta.helper && (
                    <p className="text-xs text-gray-500">{statusMeta.helper}</p>
                  )}
                  {analysisError && (
                    <p className="text-xs text-red-600">{analysisError}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
                >
                  {(isCreating || isUploading) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCreating ? (isUploading ? 'Uploading photo…' : 'Creating…') : 'Save Product'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
