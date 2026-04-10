'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Package, X } from 'lucide-react';
import { UserProduct, UserProductPhoto } from '@/lib/supabase';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import { waitForAiReferenceAngleJobs } from '@/lib/ai-reference-angle-jobs-client';
import type { AiReferenceAngleCreateJobResponse } from '@/lib/ai-reference-angle-jobs';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';
import { useI18n } from '@/providers/I18nProvider';
import AssetCreationFields from './AssetCreationFields';

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
  const { messages } = useI18n();
  const assetsMessages = messages.dashboard.assets;
  const createProductMessages = assetsMessages.createProduct;
  const createFieldsMessages = assetsMessages.createFields;
  const supabase = useSupabaseBrowserClient();
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
  const processedGenerationJobIdsRef = useRef<Set<string>>(new Set());

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
      processedGenerationJobIdsRef.current = new Set();
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
        img.onerror = () => reject(new Error(`${createProductMessages.errors.loadFailed} Please try a different file.`));
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
      setFormError(error instanceof Error ? error.message : createProductMessages.errors.loadFailed);
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (referenceImages.length >= 3) {
      setFormError(createProductMessages.errors.uploadCountLimit);
      if (event.target) event.target.value = '';
      return;
    }

    try {
      const preview = await validateAndLoadImage(file);
      setReferenceImages((prev) => [...prev, { file, preview }]);
      setFormError(null);
      setHighlightReferenceRequirement(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : createProductMessages.errors.loadFailed);
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPreviewFileFromUrl = async (imageUrl: string, fileName: string): Promise<PreviewFile> => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(createProductMessages.errors.downloadGeneratedFailed);
    }

    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
    const preview = await validateAndLoadImage(file);
    return { file, preview };
  };

  const handleGenerateReferences = async () => {
    if (!frontalImage) {
      setFormError(createProductMessages.errors.frontalFirst);
      return;
    }

    const missingCount = 3 - referenceImages.length;
    if (missingCount <= 0) {
      setFormError(createProductMessages.errors.referencesFull);
      return;
    }

    setIsGeneratingReferences(true);
    setFormError(null);
    processedGenerationJobIdsRef.current = new Set();

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
      if (!createResponse.ok || !Array.isArray(createPayload?.jobs) || createPayload.jobs.length !== missingCount) {
        throw new Error(createPayload?.error || createProductMessages.errors.generationStartFailed);
      }

      const jobs = createPayload.jobs as AiReferenceAngleCreateJobResponse[];
      const appendCompletedReferences = async (
        updatedJobs: Array<{ id: string; result_image_url: string | null; status: string }>
      ) => {
        for (let index = 0; index < jobs.length; index += 1) {
          const job = jobs[index];
          const resolvedJob = updatedJobs.find((candidate) => candidate.id === job.id);
          if (!resolvedJob || resolvedJob.status !== 'completed' || !resolvedJob.result_image_url) {
            continue;
          }
          if (processedGenerationJobIdsRef.current.has(job.id)) {
            continue;
          }

          processedGenerationJobIdsRef.current.add(job.id);
          const reference = await buildPreviewFileFromUrl(
            resolvedJob.result_image_url,
            `product-reference-angle-${index + 1}.png`
          );
          setReferenceImages((prev) => {
            if (prev.length >= 3) return prev;
            return [...prev, reference].slice(0, 3);
          });
        }
      };

      const resolvedJobs = await waitForAiReferenceAngleJobs({
        supabase,
        jobIds: jobs.map((job) => job.id),
        onJobsUpdated: (updatedJobs) => {
          void appendCompletedReferences(updatedJobs);
        }
      });
      await appendCompletedReferences(resolvedJobs);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : createProductMessages.errors.generationFailed);
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
      setFormError(createProductMessages.errors.frontalRequired);
      return;
    }

    if (!productName.trim()) {
      setFormError(createProductMessages.errors.nameRequired);
      return;
    }

    if (referenceImages.length < 1) {
      setFormError(createProductMessages.errors.referenceRequired);
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
      setFormError(error instanceof Error ? error.message : createProductMessages.errors.createFailed);
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
                  <p className="assets-modal-title text-xl font-semibold text-gray-900">{createProductMessages.title}</p>
                  <p className="assets-modal-subtitle text-sm text-gray-600">{createProductMessages.subtitle}</p>
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

            <AssetCreationFields
              fieldBadgeClassName={fieldBadgeClassName}
              formError={formError ? renderErrorMessage(formError) : null}
              highlightReferenceRequirement={highlightReferenceRequirement}
              isGeneratingReferences={isGeneratingReferences}
              isPrimaryBusy={isCreating}
              nameLabel={createFieldsMessages.nameLabel}
              nameInputId="product-name-input"
              namePlaceholder={createProductMessages.namePlaceholder}
              nameValue={productName}
              onCancel={onClose}
              onGenerateReferences={handleGenerateReferences}
              onNameChange={setProductName}
              onPrimaryClear={() => setFrontalImage(null)}
              onPrimaryTrigger={() => frontalInputRef.current?.click()}
              onReferenceAdd={referenceImages.length < 3 ? () => referenceInputRef.current?.click() : undefined}
              onReferenceRemove={removeReferenceImage}
              onSubmit={handleSubmit}
              primaryEmptyCopy={createProductMessages.frontalEmptyCopy}
              primaryEmptyTitle={createProductMessages.frontalEmptyTitle}
              primaryHelpAriaLabel={createProductMessages.frontalHelpLabel}
              primaryHelpContent={(
                <div className="rounded-lg border border-black/8 bg-[#fafaf9] px-3 py-2">
                  <p className="text-[11px] leading-5 text-gray-600">
                    {createProductMessages.frontalHelpContent}
                  </p>
                </div>
              )}
              primaryImage={frontalImage ? { src: frontalImage.preview, alt: 'Frontal preview' } : null}
              primaryPreviewLabel={createProductMessages.frontalPreviewLabel}
              primaryTitle={createProductMessages.frontalTitle}
              requiredLabel={createFieldsMessages.required}
              referenceColumns={2}
              referenceGenerateDisabled={referenceImages.length >= 3 || isCreating || isUploading || isGeneratingReferences}
              referenceMinimumLabel={createFieldsMessages.minimumOne}
              referenceHelpAriaLabel={createProductMessages.referencesHelpLabel}
              referenceHelpContent={(
                <p className="text-xs text-gray-700">
                  {createProductMessages.referencesHelpContent}
                </p>
              )}
              referenceItems={referenceGridItems}
              referenceRemoveDisabled={isCreating || isGeneratingReferences}
              referenceSlots={createProductMessages.referenceSlots}
              referenceTitle={createProductMessages.referencesTitle}
              generateLabel={createFieldsMessages.aiGenerate}
              generatingLabel={createFieldsMessages.generating}
              saveDisabled={!canSubmit}
              saveBusy={isCreating || isUploading}
              cancelLabel={createFieldsMessages.cancel}
              saveLabel={createFieldsMessages.save}
            />
            <input
              ref={frontalInputRef}
              type="file"
              accept={getAcceptedImageFormats()}
              className="hidden"
              onChange={handleFrontalUpload}
              disabled={isCreating}
            />
            <input
              ref={referenceInputRef}
              type="file"
              accept={getAcceptedImageFormats()}
              className="hidden"
              onChange={handleReferenceUpload}
              disabled={isCreating || isGeneratingReferences}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
