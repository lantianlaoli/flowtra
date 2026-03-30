'use client';

import { useEffect, useRef, useState } from 'react';
import { UserCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserAvatar } from '@/lib/supabase';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';
import AssetCreationFields from './AssetCreationFields';

interface CreateAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAvatarCreated: (avatar: UserAvatar) => void;
}

const GOOD_EXAMPLE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/examples/avatar-quality/character_ad_example.png';
const BLURRY_EXAMPLE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/examples/avatar-quality/character_ad_bad.png';

interface PreviewFile {
  file: File;
  preview: string;
}

const AVATAR_REFERENCE_SLOTS = [
  {
    label: '45° Front Left',
    description: 'Show the left-front facial angle and shoulder line.'
  },
  {
    label: '45° Front Right',
    description: 'Show the right-front facial angle and silhouette.'
  },
  {
    label: 'Back View',
    description: 'Show the rear profile, hair, or outfit details.'
  }
];

export default function CreateAvatarModal({
  isOpen,
  onClose,
  onAvatarCreated
}: CreateAvatarModalProps) {
  const fieldBadgeClassName = 'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]';
  const [avatarName, setAvatarName] = useState('');
  const [primaryImage, setPrimaryImage] = useState<PreviewFile | null>(null);
  const [referenceImages, setReferenceImages] = useState<PreviewFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingRefs, setIsUploadingRefs] = useState(false);
  const [isGeneratingReferences, setIsGeneratingReferences] = useState(false);
  const [highlightReferenceRequirement, setHighlightReferenceRequirement] = useState(false);

  const primaryInputRef = useRef<HTMLInputElement | null>(null);
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
      setAvatarName('');
      setPrimaryImage(null);
      setReferenceImages([]);
      setError(null);
      setIsGeneratingReferences(false);
      setHighlightReferenceRequirement(false);
      setTimeout(() => {
        const input = document.querySelector('#avatar-name-input') as HTMLInputElement | null;
        input?.focus();
      }, 150);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isCreating && !isUploadingRefs) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isCreating, isUploadingRefs, onClose]);

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

  const validateAndLoadImage = async (file: File): Promise<string> => {
    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      throw new Error(validationResult.error);
    }

    if (file.size > 8 * 1024 * 1024) {
      throw new Error('Image file size must be less than 8MB');
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      await new Promise<void>((resolve, reject) => {
        const img = document.createElement('img');
        img.onload = () => {
          if (img.width < 300 || img.height < 300) {
            reject(new Error(`Image too small. Minimum size is 300x300px. Your image is ${img.width}x${img.height}px.`));
            return;
          }
          resolve();
        };
        img.onerror = () => reject(new Error('Failed to load image. Please try a different file.'));
        img.src = objectUrl;
      });

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

  const handlePrimaryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const preview = await validateAndLoadImage(file);
      setPrimaryImage({ file, preview });
      setError(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to load image.');
    } finally {
      event.target.value = '';
    }
  };

  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (referenceImages.length >= 3) {
      setError('You can add up to 3 reference photos.');
      event.target.value = '';
      return;
    }

    try {
      const preview = await validateAndLoadImage(file);
      setReferenceImages((prev) => [...prev, { file, preview }]);
      setError(null);
      setHighlightReferenceRequirement(false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to load image.');
    } finally {
      event.target.value = '';
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, idx) => idx !== index));
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
    if (!primaryImage) {
      setError('Upload a primary portrait first.');
      return;
    }

    const missingCount = 3 - referenceImages.length;
    if (missingCount <= 0) {
      setError('Reference photos are already full (3/3).');
      return;
    }

    setIsGeneratingReferences(true);
    setError(null);

    try {
      const createResponse = await fetch('/api/assets/ai-reference-angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: 'avatar',
          imageDataUrl: primaryImage.preview,
          existingReferenceCount: referenceImages.length,
          count: missingCount
        })
      });

      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok || !Array.isArray(createPayload?.tasks) || createPayload.tasks.length !== missingCount) {
        throw new Error(createPayload?.error || 'Failed to start AI reference generation.');
      }

      const tasks = createPayload.tasks as Array<{ taskId: string }>;
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
        .filter(Boolean) as Array<{ imageUrl?: string | null }>;

      const generatedReferences: PreviewFile[] = [];
      for (let index = 0; index < orderedStatuses.length; index += 1) {
        const imageUrl = orderedStatuses[index].imageUrl;
        if (!imageUrl) {
          throw new Error('AI generated image URL is missing.');
        }
        const reference = await buildPreviewFileFromUrl(imageUrl, `avatar-reference-angle-${index + 1}.png`);
        generatedReferences.push(reference);
      }

      setReferenceImages(generatedReferences.slice(0, 3));
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Failed to generate AI references.');
    } finally {
      setIsGeneratingReferences(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!avatarName.trim()) {
      setError('Avatar name is required');
      return;
    }

    if (!primaryImage) {
      setError('Upload one primary avatar photo to continue.');
      return;
    }

    if (referenceImages.length < 1) {
      setError('Upload at least one reference photo to continue.');
      triggerReferenceRequirementHint();
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', primaryImage.file);
      formData.append('avatarName', avatarName.trim());

      const createResponse = await fetch('/api/user-avatars', {
        method: 'POST',
        body: formData
      });

      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok || !createPayload?.avatar) {
        throw new Error(createPayload?.error || 'Failed to create avatar');
      }

      let latestAvatar = createPayload.avatar as UserAvatar;

      if (referenceImages.length > 0) {
        setIsUploadingRefs(true);
        for (const reference of referenceImages) {
          const refFormData = new FormData();
          refFormData.append('action', 'add_reference');
          refFormData.append('file', reference.file);

          const refResponse = await fetch(`/api/user-avatars?avatarId=${latestAvatar.id}`, {
            method: 'PUT',
            body: refFormData
          });

          const refPayload = await refResponse.json().catch(() => ({}));
          if (!refResponse.ok || !refPayload?.avatar) {
            throw new Error(refPayload?.error || 'Failed to upload reference photo');
          }

          latestAvatar = refPayload.avatar as UserAvatar;
        }
      }

      onAvatarCreated(latestAvatar);
      onClose();
    } catch (submitError) {
      console.error('Error creating avatar:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Failed to create avatar. Please try again.');
    } finally {
      setIsCreating(false);
      setIsUploadingRefs(false);
    }
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && !isCreating && !isUploadingRefs) {
      onClose();
    }
  };

  const canSubmit = Boolean(
    avatarName.trim() &&
      primaryImage &&
      !isCreating &&
      !isUploadingRefs &&
      !isGeneratingReferences
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
          className="assets-modal assets-create-avatar fixed inset-0 z-50 flex items-center justify-center p-4"
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
            className="assets-modal-panel assets-create-avatar-panel relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="assets-modal-header flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                <div className="assets-modal-icon flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
                  <UserCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="assets-modal-title text-xl font-semibold text-gray-900">Create New Avatar</p>
                  <p className="assets-modal-subtitle text-sm text-gray-600">Add 1 primary portrait and 1-3 reference photos.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="assets-modal-close flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                disabled={isCreating || isUploadingRefs}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <AssetCreationFields
              fieldBadgeClassName={fieldBadgeClassName}
              formError={error ? renderErrorMessage(error) : null}
              highlightReferenceRequirement={highlightReferenceRequirement}
              isGeneratingReferences={isGeneratingReferences}
              isPrimaryBusy={isCreating || isUploadingRefs}
              nameInputId="avatar-name-input"
              namePlaceholder="Enter avatar name"
              nameValue={avatarName}
              onCancel={onClose}
              onGenerateReferences={handleGenerateReferences}
              onNameChange={setAvatarName}
              onPrimaryClear={() => setPrimaryImage(null)}
              onPrimaryTrigger={() => primaryInputRef.current?.click()}
              onReferenceAdd={referenceImages.length < 3 ? () => referenceInputRef.current?.click() : undefined}
              onReferenceRemove={removeReferenceImage}
              onSubmit={handleSubmit}
              primaryEmptyCopy="PNG or JPG, up to 8MB"
              primaryEmptyTitle="Upload primary portrait"
              primaryHelpAriaLabel="Photo examples"
              primaryHelpContent={(
                <>
                  <p className="mb-2 text-xs font-semibold text-gray-800">Portrait Photo Examples</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 overflow-hidden rounded-full border border-gray-200">
                        <Image src={GOOD_EXAMPLE_URL} alt="Good example" width={64} height={64} className="h-full w-full object-cover" />
                      </div>
                      <span className="mt-1 text-[11px] text-gray-600">Good Example</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-16 w-16 overflow-hidden rounded-full border border-gray-200">
                        <Image src={BLURRY_EXAMPLE_URL} alt="Bad example" width={64} height={64} className="h-full w-full object-cover" />
                      </div>
                      <span className="mt-1 text-[11px] text-gray-600">Bad (Blurry)</span>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-black/8 bg-[#fafaf9] px-3 py-2">
                    <p className="text-[11px] leading-5 text-gray-600">
                      Use a front-facing, well-lit portrait on a clean background.
                    </p>
                  </div>
                </>
              )}
              primaryImage={primaryImage ? { src: primaryImage.preview, alt: 'Primary preview' } : null}
              primaryPreviewLabel="Primary"
              primaryTitle="Primary Portrait"
              referenceColumns={2}
              referenceGenerateDisabled={referenceImages.length >= 3 || isCreating || isUploadingRefs || isGeneratingReferences}
              referenceHelpAriaLabel="Reference angle recommendation"
              referenceHelpContent={(
                <p className="text-xs text-gray-700">
                  Recommended: one 45° side angle and 1–2 detail/profile shots.
                </p>
              )}
              referenceItems={referenceGridItems}
              referenceRemoveDisabled={isCreating || isUploadingRefs || isGeneratingReferences}
              referenceSlots={AVATAR_REFERENCE_SLOTS}
              referenceTitle="Reference Photos"
              saveDisabled={!canSubmit}
              saveBusy={isCreating || isUploadingRefs}
            />
            <input
              ref={primaryInputRef}
              type="file"
              accept={getAcceptedImageFormats()}
              onChange={handlePrimaryUpload}
              className="hidden"
              disabled={isCreating || isUploadingRefs}
            />
            <input
              ref={referenceInputRef}
              type="file"
              accept={getAcceptedImageFormats()}
              onChange={handleReferenceUpload}
              className="hidden"
              disabled={isCreating || isUploadingRefs || isGeneratingReferences}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
