'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X, UserCircle, Upload, Loader2, AlertCircle, CircleHelp, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserAvatar } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';
import ReferenceImageGrid from './ReferenceImageGrid';

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
            <div className="assets-modal-header flex items-center justify-between border-b border-gray-200 px-6 py-5">
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

            <form onSubmit={handleSubmit} className="assets-modal-body space-y-5 px-6 py-6">
              {error && (
                <div className="assets-modal-error flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>{renderErrorMessage(error)}</span>
                </div>
              )}

              <div>
                <label htmlFor="avatar-name-input" className="assets-modal-label text-sm font-medium text-gray-700">Name</label>
                <input
                  id="avatar-name-input"
                  type="text"
                  value={avatarName}
                  onChange={(event) => setAvatarName(event.target.value)}
                  className="assets-modal-input mt-2 w-full rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm text-gray-900 transition-all focus:border-black focus:bg-white focus:outline-none focus:ring-0"
                  placeholder="Enter avatar name"
                  maxLength={60}
                />
              </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-5">
                  <div className="space-y-3 h-full min-h-0 flex flex-col">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium leading-5 text-gray-900">Primary Portrait</p>
                      <span className={`${fieldBadgeClassName} border-black/10 bg-black/[0.04] text-black/75`}>
                        Required
                      </span>
                      <div className="relative group">
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 align-middle"
                        aria-label="Photo examples"
                      >
                        <CircleHelp className="h-4 w-4" />
                      </button>
                      <div className="pointer-events-none absolute left-0 top-6 z-20 w-72 rounded-xl border border-gray-200 bg-white p-3 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                        <p className="text-xs font-semibold text-gray-800 mb-2">Portrait Photo Examples</p>
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
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Use a front-facing, well-lit portrait on a clean background.</p>

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => primaryInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        primaryInputRef.current?.click();
                      }
                    }}
                    className={cn(
                      'assets-modal-upload relative w-full aspect-[4/5] max-h-[560px] overflow-hidden rounded-2xl border-2 border-dashed transition',
                      primaryImage ? 'border-gray-300 bg-[#F8F8F8]' : 'border-gray-300 bg-[#FAFAFA]'
                    )}
                  >
                    <div className="absolute left-3 top-3">
                      <span className="rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">Primary</span>
                    </div>

                    {primaryImage ? (
                      <>
                        <Image src={primaryImage.preview} alt="Primary preview" fill className="object-cover" />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPrimaryImage(null);
                          }}
                          className="assets-modal-chip-close absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-gray-600">
                        <Upload className="mb-3 h-7 w-7 text-gray-400" />
                        <p className="text-base font-semibold text-gray-900">Upload primary portrait</p>
                        <p className="mt-1 text-xs text-gray-500">PNG or JPG, up to 8MB</p>
                      </div>
                    )}
                  </div>

                  <input
                    ref={primaryInputRef}
                    type="file"
                    accept={getAcceptedImageFormats()}
                    onChange={handlePrimaryUpload}
                    className="hidden"
                    disabled={isCreating || isUploadingRefs}
                  />
                </div>

                <div className="space-y-3 h-full min-h-0 flex flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 leading-none">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">Reference Photos</p>
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
                            Recommended: one 45° side angle and 1–2 detail/profile shots.
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateReferences}
                      disabled={!primaryImage || referenceImages.length >= 3 || isCreating || isUploadingRefs || isGeneratingReferences}
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

                  <div className="flex-1 min-h-0">
                    <ReferenceImageGrid
                      items={referenceGridItems}
                      isGenerating={isGeneratingReferences}
                      onAdd={referenceImages.length < 3 ? () => referenceInputRef.current?.click() : undefined}
                      onRemove={removeReferenceImage}
                      removeDisabled={isCreating || isUploadingRefs || isGeneratingReferences}
                      slots={AVATAR_REFERENCE_SLOTS}
                    />
                  </div>

                  <input
                    ref={referenceInputRef}
                    type="file"
                    accept={getAcceptedImageFormats()}
                    onChange={handleReferenceUpload}
                    className="hidden"
                    disabled={isCreating || isUploadingRefs || isGeneratingReferences}
                  />
                </div>
              </div>

              <div className="assets-modal-actions flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="assets-modal-secondary flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
                  disabled={isCreating || isUploadingRefs}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="assets-modal-primary flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {(isCreating || isUploadingRefs) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
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
