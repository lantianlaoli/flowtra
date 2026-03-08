'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { AlertCircle, Check, CircleHelp, Loader2, Sparkles, Trash2, Upload, UserCircle, X } from 'lucide-react';
import {
  type AvatarPhotoSet,
  normalizeAvatarPhotoSet,
  type UserAvatar
} from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';

interface EditAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  avatar: UserAvatar | null;
  onAvatarUpdated: (avatar: UserAvatar) => void;
  onDelete?: (avatarId: string) => Promise<void> | void;
  isDeleting?: boolean;
}

type AvatarAction = 'rename' | 'replace_primary' | 'add_reference' | 'delete_reference' | 'promote_reference_to_primary';

export default function EditAvatarModal({
  isOpen,
  onClose,
  avatar,
  onAvatarUpdated,
  onDelete,
  isDeleting = false
}: EditAvatarModalProps) {
  const fieldBadgeClassName = 'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]';
  const [avatarName, setAvatarName] = useState('');
  const [currentAvatar, setCurrentAvatar] = useState<UserAvatar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [isGeneratingReferences, setIsGeneratingReferences] = useState(false);

  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);

  const photoSet: AvatarPhotoSet | null = useMemo(() => {
    if (!currentAvatar) return null;
    return normalizeAvatarPhotoSet(
      currentAvatar.photo_set_json,
      currentAvatar.photo_url,
      currentAvatar.file_name
    );
  }, [currentAvatar]);

  useEffect(() => {
    if (isOpen && avatar) {
      setCurrentAvatar(avatar);
      setAvatarName(avatar.avatar_name);
      setError(null);
      setIsSaving(false);
      setIsUploadingPhotos(false);
      setIsGeneratingReferences(false);
    }
  }, [isOpen, avatar]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isSaving && !isUploadingPhotos && !isGeneratingReferences) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSaving, isUploadingPhotos, isGeneratingReferences, onClose]);

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

  const runAvatarAction = async ({
    action,
    file,
    referenceIndex,
    nextName
  }: {
    action: AvatarAction;
    file?: File;
    referenceIndex?: number;
    nextName?: string;
  }) => {
    if (!currentAvatar) return;

    const isPhotoAction = action === 'replace_primary' || action === 'add_reference' || action === 'delete_reference' || action === 'promote_reference_to_primary';
    if (isPhotoAction) {
      setIsUploadingPhotos(true);
    } else {
      setIsSaving(true);
    }

    setError(null);

    try {
      let response: Response;

      if (file) {
        const formData = new FormData();
        formData.append('action', action);
        formData.append('file', file);
        if (typeof referenceIndex === 'number') {
          formData.append('referenceIndex', String(referenceIndex));
        }

        response = await fetch(`/api/user-avatars?avatarId=${currentAvatar.id}`, {
          method: 'PUT',
          body: formData
        });
      } else {
        response = await fetch(`/api/user-avatars?avatarId=${currentAvatar.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            avatarName: nextName,
            referenceIndex
          })
        });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.avatar) {
        throw new Error(payload?.error || 'Failed to update avatar');
      }

      setCurrentAvatar(payload.avatar as UserAvatar);
      onAvatarUpdated(payload.avatar as UserAvatar);
    } finally {
      if (isPhotoAction) {
        setIsUploadingPhotos(false);
      } else {
        setIsSaving(false);
      }
    }
  };

  const validateImageFile = async (file: File) => {
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
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handlePrimaryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !photoSet) return;

    try {
      await validateImageFile(file);
      await runAvatarAction({ action: 'replace_primary', file });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload primary photo.');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !photoSet) return;

    if (photoSet.references.length >= 3) {
      setError('You can add up to 3 reference photos.');
      if (event.target) event.target.value = '';
      return;
    }

    try {
      await validateImageFile(file);
      await runAvatarAction({ action: 'add_reference', file });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload reference photo.');
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const handleDeleteReference = async (index: number) => {
    try {
      await runAvatarAction({ action: 'delete_reference', referenceIndex: index });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete reference photo.');
    }
  };

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const convertImageUrlToDataUrl = async (imageUrl: string): Promise<string> => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to read primary image for AI generation.');
    }

    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert image to data URL.'));
      reader.readAsDataURL(blob);
    });
  };

  const buildFileFromUrl = async (imageUrl: string, fileName: string): Promise<File> => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to download generated reference image.');
    }

    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
    await validateImageFile(file);
    return file;
  };

  const handleGenerateReferences = async () => {
    if (!photoSet?.primary?.photo_url) {
      setError('Upload a primary portrait first.');
      return;
    }

    const missingCount = 3 - photoSet.references.length;
    if (missingCount <= 0) {
      setError('Reference photos are already full (3/3).');
      return;
    }

    setIsGeneratingReferences(true);
    setError(null);

    try {
      const imageDataUrl = await convertImageUrlToDataUrl(photoSet.primary.photo_url);

      const createResponse = await fetch('/api/assets/ai-reference-angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: 'avatar',
          imageDataUrl,
          existingReferenceCount: photoSet.references.length,
          count: missingCount
        })
      });

      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok || !Array.isArray(createPayload?.tasks) || createPayload.tasks.length !== missingCount) {
        throw new Error(createPayload?.error || 'Failed to start AI reference generation.');
      }

      const tasks = createPayload.tasks as Array<{ taskId: string }>;
      let resolvedStatuses: Array<{
        taskId: string;
        status: 'pending' | 'success' | 'failed';
        imageUrl?: string | null;
        failMsg?: string | null;
      }> = [];

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

      for (let index = 0; index < orderedStatuses.length; index += 1) {
        const imageUrl = orderedStatuses[index].imageUrl;
        if (!imageUrl) {
          throw new Error('AI generated image URL is missing.');
        }
        const referenceFile = await buildFileFromUrl(imageUrl, `avatar-reference-angle-${index + 1}.png`);
        await runAvatarAction({ action: 'add_reference', file: referenceFile });
      }
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate AI references.');
    } finally {
      setIsGeneratingReferences(false);
    }
  };

  const handleSaveChanges = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentAvatar) return;

    const trimmedName = avatarName.trim();
    if (!trimmedName) {
      setError('Avatar name is required.');
      return;
    }

    if (trimmedName === currentAvatar.avatar_name) {
      onClose();
      return;
    }

    try {
      await runAvatarAction({ action: 'rename', nextName: trimmedName });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save avatar.');
    }
  };

  const handleDeleteAvatar = () => {
    if (!onDelete || !currentAvatar) return;
    void onDelete(currentAvatar.id);
    onClose();
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && !isSaving && !isUploadingPhotos && !isGeneratingReferences) {
      onClose();
    }
  };

  if (!avatar || !currentAvatar || !photoSet) return null;

  const canSave = Boolean(avatarName.trim() && !isSaving && !isUploadingPhotos && !isGeneratingReferences);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="assets-modal assets-edit-avatar fixed inset-0 z-50 flex items-center justify-center p-4"
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
              className="assets-modal-panel assets-edit-avatar-panel relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl"
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
                    <p className="assets-modal-title text-xl font-semibold text-gray-900">Edit Avatar</p>
                    <p className="assets-modal-subtitle text-sm text-gray-600">Manage name and avatar photos in one place.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="assets-modal-close flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                  disabled={isSaving || isUploadingPhotos || isGeneratingReferences}
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSaveChanges} className="assets-modal-body space-y-5 px-6 py-6">
                {error && (
                  <div className="assets-modal-error flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4" />
                    <span>{renderErrorMessage(error)}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="edit-avatar-name-input" className="assets-modal-label text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    id="edit-avatar-name-input"
                    type="text"
                    value={avatarName}
                    onChange={(event) => setAvatarName(event.target.value)}
                    className="assets-modal-input mt-2 w-full rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm text-gray-900 transition-all focus:border-black focus:bg-white focus:outline-none focus:ring-0"
                    placeholder="Enter avatar name"
                    maxLength={60}
                    disabled={isSaving || isUploadingPhotos || isGeneratingReferences}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">Primary Portrait</p>
                        <span className={`${fieldBadgeClassName} border-black/10 bg-black/[0.04] text-black/75`}>
                          Required
                        </span>
                      </div>
                    </div>

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
                      className="assets-modal-upload relative w-full aspect-[4/5] max-h-[560px] overflow-hidden rounded-2xl border-2 border-dashed border-gray-300 bg-[#F8F8F8]"
                    >
                      <div className="absolute left-3 top-3">
                        <span className="assets-modal-chip rounded-full border border-gray-300 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          Primary
                        </span>
                      </div>

                      <Image src={photoSet.primary.photo_url} alt="Primary preview" fill className="object-cover" />

                      <button
                        type="button"
                        className="assets-modal-chip-close absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                        onClick={(event) => {
                          event.stopPropagation();
                          primaryInputRef.current?.click();
                        }}
                        disabled={isSaving || isUploadingPhotos || isGeneratingReferences}
                      >
                        {isUploadingPhotos ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      </button>

                      <input
                        ref={primaryInputRef}
                        type="file"
                        accept={getAcceptedImageFormats()}
                        className="hidden"
                        onChange={handlePrimaryUpload}
                        disabled={isSaving || isUploadingPhotos || isGeneratingReferences}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 h-full min-h-0 flex flex-col">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 leading-none">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">Reference Photos</p>
                          <span className={`${fieldBadgeClassName} border-gray-200 bg-gray-50 text-gray-500`}>
                            Optional
                          </span>
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
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{photoSet.references.length}/3</span>
                        <button
                          type="button"
                          onClick={handleGenerateReferences}
                          disabled={!photoSet.primary || photoSet.references.length >= 3 || isSaving || isUploadingPhotos || isGeneratingReferences}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
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

                    <div className="grid flex-1 min-h-0 grid-cols-2 grid-rows-[auto_minmax(0,1fr)] gap-3">
                      {photoSet.references.map((photo, index) => (
                        <div
                          key={`${photo.photo_url}-${index}`}
                          className={cn(
                            'relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50',
                            photoSet.references.length === 3 && index === 2
                              ? 'col-span-2 h-full min-h-[220px]'
                              : 'aspect-square'
                          )}
                        >
                          <Image
                            src={photo.photo_url}
                            alt={`Reference ${index + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 45vw, 220px"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeleteReference(index);
                            }}
                            className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black"
                            disabled={isSaving || isUploadingPhotos || isGeneratingReferences}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}

                      {photoSet.references.length < 3 && (
                        <button
                          type="button"
                          onClick={() => referenceInputRef.current?.click()}
                          className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-[#FAFAFA] text-gray-500 transition hover:border-gray-400"
                          disabled={isSaving || isUploadingPhotos || isGeneratingReferences}
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
                      disabled={isSaving || isUploadingPhotos || isGeneratingReferences}
                    />
                  </div>
                </div>

                <div className="assets-modal-actions flex flex-col gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleDeleteAvatar}
                    className="assets-modal-secondary flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                    disabled={!onDelete || isDeleting || isSaving || isUploadingPhotos || isGeneratingReferences}
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </button>
                  <button
                    type="submit"
                    disabled={!canSave}
                    className="assets-modal-primary flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
