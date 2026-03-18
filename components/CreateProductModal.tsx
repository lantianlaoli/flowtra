'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { AlertCircle, Check, CircleHelp, Loader2, Package, Sparkles, Upload, X } from 'lucide-react';
import { UserProduct, UserProductPhoto } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';
import ReferenceImageGrid, { PRODUCT_REFERENCE_SLOTS } from './ReferenceImageGrid';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: UserProduct) => void;
}

interface PreviewFile {
  file: File;
  preview: string;
}

export default function CreateProductModal({
  isOpen,
  onClose,
  onProductCreated
}: CreateProductModalProps) {
  const fieldBadgeClassName = 'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]';
  const [productName, setProductName] = useState('');
  const [frontalImage, setFrontalImage] = useState<PreviewFile | null>(null);
  const [referenceImages, setReferenceImages] = useState<PreviewFile[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingReferences, setIsGeneratingReferences] = useState(false);
  const [highlightReferenceRequirement, setHighlightReferenceRequirement] = useState(false);
  const frontalInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);

  const triggerReferenceRequirementHint = () => {
    setHighlightReferenceRequirement(false);
    requestAnimationFrame(() => {
      setHighlightReferenceRequirement(true);
      window.setTimeout(() => setHighlightReferenceRequirement(false), 1100);
    });
  };

  useEffect(() => {
    if (isOpen) {
      setProductName('');
      setFrontalImage(null);
      setReferenceImages([]);
      setFormError(null);
      setIsGeneratingReferences(false);
      setHighlightReferenceRequirement(false);
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
      setHighlightReferenceRequirement(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to load image.');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const buildPreviewFileFromUrl = async (imageUrl: string, fileName: string): Promise<PreviewFile> => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to download generated reference image.');
    }

    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
    const preview = await validateAndLoadImage(file);
    return { file, preview };
  };

  const handleGenerateReferences = async () => {
    if (!frontalImage) {
      setFormError('Upload a frontal image first.');
      return;
    }

    const missingCount = 3 - referenceImages.length;
    if (missingCount <= 0) {
      setFormError('Reference images are already full (3/3).');
      return;
    }

    setIsGeneratingReferences(true);
    setFormError(null);

    try {
      const createResponse = await fetch('/api/assets/ai-reference-angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: 'product',
          imageDataUrl: frontalImage.preview,
          existingReferenceCount: referenceImages.length,
          count: missingCount
        })
      });

      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok || !Array.isArray(createPayload?.tasks) || createPayload.tasks.length !== missingCount) {
        throw new Error(createPayload?.error || 'Failed to start AI reference generation.');
      }

      const tasks = createPayload.tasks as Array<{ taskId: string; key: string }>;
      let resolvedStatuses: Array<{ taskId: string; status: 'pending' | 'success' | 'failed'; imageUrl?: string | null; failMsg?: string | null }> = [];

      for (let attempt = 0; attempt < 45; attempt += 1) {
        const params = new URLSearchParams();
        tasks.forEach((task) => params.append('taskId', task.taskId));

        const statusResponse = await fetch(`/api/assets/ai-reference-angles?${params.toString()}`, {
          method: 'GET'
        });

        const statusPayload = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok || !Array.isArray(statusPayload?.statuses)) {
          throw new Error(statusPayload?.error || 'Failed to check AI generation progress.');
        }

        resolvedStatuses = statusPayload.statuses;
        const allFinished = resolvedStatuses.every(
          (item) => item.status === 'success' || item.status === 'failed'
        );

        if (allFinished) {
          break;
        }

        await wait(2500);
      }

      if (!resolvedStatuses.length || resolvedStatuses.some((item) => item.status !== 'success')) {
        const failedTask = resolvedStatuses.find((item) => item.status === 'failed');
        throw new Error(failedTask?.failMsg || 'AI reference generation timed out. Please try again.');
      }

      const orderedStatuses = tasks
        .map((task) => resolvedStatuses.find((item) => item.taskId === task.taskId))
        .filter(Boolean) as Array<{ taskId: string; status: 'success'; imageUrl?: string | null; key?: string }>;

      const generatedReferences: PreviewFile[] = [];
      for (let index = 0; index < orderedStatuses.length; index += 1) {
        const imageUrl = orderedStatuses[index].imageUrl;
        if (!imageUrl) {
          throw new Error('AI generated image URL is missing.');
        }
        const reference = await buildPreviewFileFromUrl(imageUrl, `product-reference-angle-${index + 1}.png`);
        generatedReferences.push(reference);
      }

      setReferenceImages(generatedReferences.slice(0, 3));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Failed to generate AI references.');
    } finally {
      setIsGeneratingReferences(false);
    }
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

    if (referenceImages.length < 1) {
      setFormError('Upload at least one reference image to continue.');
      triggerReferenceRequirementHint();
      return;
    }

    setIsCreating(true);
    setFormError(null);

    try {
      const response = await fetch('/api/user-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productName.trim()
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
    frontalImage && productName.trim() && !isCreating && !isUploading && !isGeneratingReferences
  );

  const referenceGridItems = referenceImages.map((reference, index) => ({
    alt: `Reference ${index + 1}`,
    key: `reference-${index}`,
    src: reference.preview
  }));

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
                  <p className="assets-modal-subtitle text-sm text-gray-600">Add 1 frontal image and 1-3 reference images.</p>
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
                    Name
                  </label>
                  <input
                    id="product-name-input"
                    type="text"
                    value={productName}
                    onChange={(event) => setProductName(event.target.value)}
                    className="assets-modal-input mt-2 w-full rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm text-gray-900 transition-all focus:border-black focus:bg-white focus:outline-none focus:ring-0"
                    placeholder="Enter product name"
                    maxLength={60}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-5">
                  <div className="space-y-3 h-full min-h-0 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">Frontal Image</p>
                        <span className={`${fieldBadgeClassName} border-black/10 bg-black/[0.04] text-black/75`}>
                          Required
                        </span>
                      </div>
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

                  <div className="space-y-3 h-full min-h-0 flex flex-col">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 leading-none">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">Reference Images</p>
                          <motion.span
                            className={`${fieldBadgeClassName} ${highlightReferenceRequirement ? 'border-black/20 bg-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.14)]' : 'border-gray-200 bg-gray-50 text-gray-600'}`}
                            animate={highlightReferenceRequirement ? { scale: [1, 1.08, 1], x: [0, -3, 3, 0] } : { scale: 1, x: 0 }}
                            transition={{ duration: 0.45, ease: 'easeInOut' }}
                          >
                            Min 1
                          </motion.span>
                        </div>
                        <div className="relative group">
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600"
                            aria-label="Reference angle recommendation"
                          >
                            <CircleHelp className="h-4 w-4" />
                          </button>
                          <div className="pointer-events-none absolute right-0 top-6 z-20 w-72 rounded-xl border border-gray-200 bg-white p-3 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                            <p className="text-xs text-gray-700">
                              Recommendation: upload one 45° front-angle shot and up to two extra detail shots for function or structure (such as back view or close-up).
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateReferences}
                          disabled={!frontalImage || referenceImages.length >= 3 || isCreating || isUploading || isGeneratingReferences}
                          className="assets-ai-generate-button inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          {isGeneratingReferences ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          {isGeneratingReferences ? 'Generating…' : 'AI Generate'}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0">
                      <ReferenceImageGrid
                        items={referenceGridItems}
                        isGenerating={isGeneratingReferences}
                        onAdd={referenceImages.length < 3 ? () => referenceInputRef.current?.click() : undefined}
                        onRemove={removeReferenceImage}
                        removeDisabled={isCreating || isGeneratingReferences}
                        slots={PRODUCT_REFERENCE_SLOTS}
                      />
                    </div>

                    <input
                      ref={referenceInputRef}
                      type="file"
                      accept={getAcceptedImageFormats()}
                      className="hidden"
                      onChange={handleReferenceUpload}
                      disabled={isCreating || isGeneratingReferences}
                    />

                  </div>
                </div>
              </div>

              <div className="assets-modal-actions flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="assets-modal-secondary flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                  disabled={isCreating}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="assets-modal-primary flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
                >
                  {(isCreating || isUploading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
