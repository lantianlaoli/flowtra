'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { AlertCircle, ArrowLeft, Check, Loader2, PawPrint, Sparkles, Trash2, Upload, X } from 'lucide-react';
import {
  type UserPet,
  type PetPhotoView
} from '@/lib/supabase';
import { useSupabaseBrowserClient } from '@/lib/supabase/client';
import { waitForAiReferenceAngleJobs } from '@/lib/ai-reference-angle-jobs-client';
import type { AiReferenceAngleCreateJobResponse } from '@/lib/ai-reference-angle-jobs';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';

interface EditPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  pet: UserPet | null;
  onPetUpdated: (pet: UserPet) => void;
  onDelete?: (petId: string) => Promise<void> | void;
  isDeleting?: boolean;
  embedded?: boolean;
}

const PET_VIEWS: Array<{ view: PetPhotoView; label: string }> = [
  { view: 'front', label: 'Front' },
  { view: 'side', label: 'Side' },
  { view: 'back', label: 'Back' },
];

export default function EditPetModal({
  isOpen,
  onClose,
  pet,
  onPetUpdated,
  onDelete,
  isDeleting = false,
  embedded = false
}: EditPetModalProps) {
  const supabase = useSupabaseBrowserClient();
  const [petName, setPetName] = useState('');
  const [currentPet, setCurrentPet] = useState<UserPet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingView, setUploadingView] = useState<PetPhotoView | null>(null);
  const [isGeneratingReferences, setIsGeneratingReferences] = useState(false);

  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const sideInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);
  const resumedGenerationKeyRef = useRef<string | null>(null);
  const processedGenerationJobIdsRef = useRef<Set<string>>(new Set());

  const generationStorageKey = currentPet?.front_photo_url
    ? `edit-pet-ai-angle-jobs:${currentPet.id}:${currentPet.front_photo_url}`
    : null;

  const readStoredJobIds = useCallback(() => {
    if (!generationStorageKey || typeof window === 'undefined') return [];

    try {
      const raw = window.sessionStorage.getItem(generationStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed?.jobIds) ? (parsed.jobIds as string[]) : [];
    } catch {
      return [];
    }
  }, [generationStorageKey]);

  const persistJobIds = (jobIds: string[]) => {
    if (!generationStorageKey || typeof window === 'undefined') return;
    window.sessionStorage.setItem(generationStorageKey, JSON.stringify({ jobIds }));
  };

  const clearPersistedJobIds = useCallback(() => {
    if (!generationStorageKey || typeof window === 'undefined') return;
    window.sessionStorage.removeItem(generationStorageKey);
  }, [generationStorageKey]);

  useEffect(() => {
    if (isOpen && pet) {
      setCurrentPet(pet);
      setPetName(pet.pet_name);
      setError(null);
      setIsSaving(false);
      setUploadingView(null);
      setIsGeneratingReferences(false);
    }
  }, [isOpen, pet]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isSaving && !uploadingView && !isGeneratingReferences) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSaving, uploadingView, isGeneratingReferences, onClose]);

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

  const validateImageFile = async (file: File) => {
    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      throw new Error(validationResult.error);
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error('Image is too large. Maximum size is 8MB.');
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

  const handlePhotoReplace = async (view: PetPhotoView, file: File) => {
    if (!currentPet) return;

    try {
      await validateImageFile(file);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to validate image.');
      return;
    }

    setUploadingView(view);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('action', 'replace_photo');
      formData.append('view', view);
      formData.append('file', file);

      const response = await fetch(`/api/user-pets?petId=${currentPet.id}`, {
        method: 'PUT',
        body: formData
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.pet) {
        throw new Error(payload?.error || 'Failed to replace photo');
      }

      setCurrentPet(payload.pet as UserPet);
      onPetUpdated(payload.pet as UserPet);
    } catch (replaceError) {
      setError(replaceError instanceof Error ? replaceError.message : 'Failed to replace photo.');
    } finally {
      setUploadingView(null);
    }
  };

  const handlePhotoUpload = async (view: PetPhotoView, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await handlePhotoReplace(view, file);

    if (event.target) event.target.value = '';
  };

  const convertImageUrlToDataUrl = async (imageUrl: string): Promise<string> => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to read pet photo for AI generation.');
    }

    const blob = await response.blob();

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert image to data URL.'));
      reader.readAsDataURL(blob);
    });
  };

  const buildFileFromUrl = useCallback(async (imageUrl: string, fileName: string): Promise<File> => {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('Failed to download generated reference image.');
    }

    const blob = await response.blob();
    const file = new File([blob], fileName, { type: blob.type || 'image/png' });
    await validateImageFile(file);
    return file;
  }, []);

  const resolveGeneratedReferences = useCallback(async (jobIds: string[]) => {
    setIsGeneratingReferences(true);
    setError(null);
    processedGenerationJobIdsRef.current = new Set();

    try {
      const uploadCompletedReferences = async (
        updatedJobs: Array<{ id: string; result_image_url: string | null; status: string }>
      ) => {
        // For pets, we replace the side and back photos with generated angles
        const viewOrder: PetPhotoView[] = ['side', 'back'];

        for (let index = 0; index < Math.min(jobIds.length, viewOrder.length); index += 1) {
          const jobId = jobIds[index];
          const targetView = viewOrder[index];
          const resolvedJob = updatedJobs.find((job) => job.id === jobId);
          const imageUrl = resolvedJob?.result_image_url;
          if (!resolvedJob || resolvedJob.status !== 'completed' || !imageUrl) {
            continue;
          }
          if (processedGenerationJobIdsRef.current.has(jobId)) {
            continue;
          }

          processedGenerationJobIdsRef.current.add(jobId);
          const referenceFile = await buildFileFromUrl(imageUrl, `pet-reference-angle-${index + 1}.png`);
          await handlePhotoReplace(targetView, referenceFile);
        }
      };

      const resolvedJobs = await waitForAiReferenceAngleJobs({
        supabase,
        jobIds,
        onJobsUpdated: (updatedJobs) => {
          void uploadCompletedReferences(updatedJobs);
        }
      });
      await uploadCompletedReferences(resolvedJobs);

      clearPersistedJobIds();
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : 'Failed to generate AI references.';
      if (!message.includes('still in progress')) {
        clearPersistedJobIds();
      }
      setError(message);
    } finally {
      setIsGeneratingReferences(false);
    }
  }, [buildFileFromUrl, clearPersistedJobIds, supabase]);

  useEffect(() => {
    if (!isOpen || !generationStorageKey) return;

    const storedJobIds = readStoredJobIds();
    if (!storedJobIds.length) return;
    if (resumedGenerationKeyRef.current === generationStorageKey) return;

    resumedGenerationKeyRef.current = generationStorageKey;
    void resolveGeneratedReferences(storedJobIds);
  }, [generationStorageKey, isOpen, readStoredJobIds, resolveGeneratedReferences]);

  const handleGenerateReferences = async () => {
    if (!currentPet?.front_photo_url) {
      setError('No front photo available for AI generation.');
      return;
    }

    setIsGeneratingReferences(true);
    setError(null);

    try {
      const imageDataUrl = await convertImageUrlToDataUrl(currentPet.front_photo_url);

      // Generate 2 angles (side and back) — place them in the side and back slots
      const createResponse = await fetch('/api/assets/ai-reference-angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: 'pet',
          imageDataUrl,
          existingReferenceCount: 0,
          count: 2
        })
      });

      const createPayload = await createResponse.json().catch(() => ({}));
      if (!createResponse.ok || !Array.isArray(createPayload?.jobs) || createPayload.jobs.length !== 2) {
        throw new Error(createPayload?.error || 'Failed to start AI reference generation.');
      }

      const jobs = createPayload.jobs as AiReferenceAngleCreateJobResponse[];
      const jobIds = jobs.map((job) => job.id);
      persistJobIds(jobIds);
      resumedGenerationKeyRef.current = generationStorageKey;
      await resolveGeneratedReferences(jobIds);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate AI references.');
    }
  };

  const handleSaveChanges = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentPet) return;

    const trimmedName = petName.trim();
    if (!trimmedName) {
      setError('Pet name is required.');
      return;
    }
    if (trimmedName.length > 255) {
      setError('Pet name is too long.');
      return;
    }

    if (trimmedName === currentPet.pet_name) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/user-pets?petId=${currentPet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          petName: trimmedName
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.pet) {
        throw new Error(payload?.error || 'Failed to rename pet');
      }

      setCurrentPet(payload.pet as UserPet);
      onPetUpdated(payload.pet as UserPet);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save pet name.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePet = async () => {
    if (!onDelete || !currentPet) return;
    setError(null);
    try {
      await onDelete(currentPet.id);
      onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete pet.');
    }
  };

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget && !isSaving && !uploadingView && !isGeneratingReferences) {
      onClose();
    }
  };

  if (!pet || !currentPet) return null;

  const canSave = Boolean(petName.trim() && !isSaving && !uploadingView && !isGeneratingReferences);

  const fieldBadgeClassName = 'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]';

  const content = isOpen ? (
    <motion.div
      className={embedded
        ? 'relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-white'
        : 'relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl'}
      initial={{ opacity: 0, scale: embedded ? 1 : 0.95, y: embedded ? 0 : 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: embedded ? 1 : 0.95, y: embedded ? 0 : 20 }}
      transition={{ duration: 0.2 }}
    >
      <div className={`flex items-center justify-between border-b border-gray-200 ${embedded ? 'px-5 py-3.5' : 'px-6 py-5'}`}>
        <div className="flex items-center gap-3">
          {embedded ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-xs font-semibold text-black hover:bg-gray-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black text-white">
              <PawPrint className="h-5 w-5" />
            </div>
          )}
          <div>
            <p className={`font-semibold text-gray-900 ${embedded ? 'text-base' : 'text-xl'}`}>Edit Pet</p>
            {!embedded ? <p className="text-sm text-gray-600">Manage pet name and photos in one place.</p> : null}
          </div>
        </div>
        {!embedded ? <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
          disabled={isSaving || !!uploadingView || isGeneratingReferences}
        >
          <X className="h-5 w-5 text-gray-500" />
        </button> : null}
      </div>

      <form onSubmit={handleSaveChanges} className={`space-y-5 overflow-y-auto ${embedded ? 'px-5 py-5' : 'px-6 py-6'}`}>
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>{renderErrorMessage(error)}</span>
          </div>
        )}

        <div>
          <label htmlFor="edit-pet-name-input" className="text-sm font-medium text-gray-700">
            Name
          </label>
          <input
            id="edit-pet-name-input"
            type="text"
            value={petName}
            onChange={(event) => setPetName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm text-gray-900 transition-all focus:border-black focus:bg-white focus:outline-none focus:ring-0"
            placeholder="Enter pet name"
            maxLength={255}
            disabled={isSaving || !!uploadingView || isGeneratingReferences}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900">Pet Photos</p>
              <span className={`${fieldBadgeClassName} border-black/10 bg-black/[0.04] text-black/75`}>
                Required
              </span>
            </div>
            <button
              type="button"
              onClick={handleGenerateReferences}
              disabled={!currentPet.front_photo_url || isSaving || !!uploadingView || isGeneratingReferences}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {isGeneratingReferences ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {isGeneratingReferences ? 'Generating...' : 'AI Generate'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {PET_VIEWS.map(({ view, label }) => {
              const photoUrl = currentPet[`${view}_photo_url` as keyof UserPet] as string;
              const inputRef = view === 'front' ? frontInputRef : view === 'side' ? sideInputRef : backInputRef;
              const isUploading = uploadingView === view;

              return (
                <div key={view} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <PawPrint className="h-4 w-4" />
                    {label}
                  </div>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={isSaving || !!uploadingView || isGeneratingReferences}
                    className="relative block w-full cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-white hover:border-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="relative aspect-square w-full">
                      <Image
                        src={photoUrl}
                        alt={`${label} view`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 33vw, 180px"
                        unoptimized
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                        <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-900">
                          {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Replace
                        </div>
                      </div>
                    </div>
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={getAcceptedImageFormats()}
                    className="hidden"
                    onChange={(event) => {
                      void handlePhotoUpload(view, event);
                    }}
                    disabled={isSaving || !!uploadingView || isGeneratingReferences}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={handleDeletePet}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            disabled={!onDelete || isDeleting || isSaving || !!uploadingView || isGeneratingReferences}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    </motion.div>
  ) : null;

  if (embedded) {
    return content;
  }

  return (
    <AnimatePresence>
      {content ? (
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
          {content}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
