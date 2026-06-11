'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, PawPrint, Upload, X } from 'lucide-react';
import type { PetPhotoView, UserPet } from '@/lib/supabase';
import { getAcceptedImageFormats, validateImageFormat } from '@/lib/image-validation';

type PreviewFile = { file: File; preview: string };
const PET_VIEWS: Array<{ view: PetPhotoView; label: string }> = [
  { view: 'front', label: 'Front' },
  { view: 'side', label: 'Side' },
  { view: 'back', label: 'Back' },
];

export default function CreatePetModal({
  isOpen,
  onClose,
  onPetCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onPetCreated: (pet: UserPet) => void;
}) {
  const [petName, setPetName] = useState('');
  const [photos, setPhotos] = useState<Partial<Record<PetPhotoView, PreviewFile>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPetName('');
    setPhotos({});
    setError(null);
    setIsSaving(false);
    window.setTimeout(() => nameInputRef.current?.focus(), 120);
  }, [isOpen]);

  const canSave = useMemo(
    () => Boolean(petName.trim() && photos.front && photos.side && photos.back && !isSaving),
    [isSaving, petName, photos]
  );

  if (!isOpen) return null;

  const validateAndLoadImage = async (file: File): Promise<string> => {
    const validation = validateImageFormat(file);
    if (!validation.isValid) throw new Error(validation.error);
    if (file.size > 8 * 1024 * 1024) throw new Error('Image is too large. Maximum size is 8MB.');

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
        img.onerror = () => reject(new Error('Failed to load image. Please try another file.'));
        img.src = objectUrl;
      });
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleUpload = async (view: PetPhotoView, file: File) => {
    try {
      const preview = await validateAndLoadImage(file);
      setPhotos((current) => ({ ...current, [view]: { file, preview } }));
      setError(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to process image.');
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave || !photos.front || !photos.side || !photos.back) return;

    setIsSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('petName', petName.trim());
      formData.append('front', photos.front.file);
      formData.append('side', photos.side.file);
      formData.append('back', photos.back.file);

      const response = await fetch('/api/user-pets', { method: 'POST', body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.pet) {
        throw new Error(payload?.error || 'Failed to save pet.');
      }
      onPetCreated(payload.pet as UserPet);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save pet.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Save Pet Asset</h2>
            <p className="mt-1 text-sm text-gray-500">Upload front, side, and back views for reusable pet replacement.</p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-900 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-900">Pet name</label>
            <input
              ref={nameInputRef}
              value={petName}
              onChange={(event) => setPetName(event.target.value)}
              disabled={isSaving}
              placeholder="e.g. Milo"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-black disabled:opacity-50"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {PET_VIEWS.map(({ view, label }) => {
              const photo = photos[view];
              return (
                <div key={view} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <PawPrint className="h-4 w-4" />
                    {label}
                  </div>
                  <label className="relative block cursor-pointer overflow-hidden rounded-lg border border-dashed border-gray-300 bg-white hover:border-black">
                    {photo ? (
                      <Image src={photo.preview} alt={`${label} pet`} width={360} height={360} className="aspect-square w-full object-cover" unoptimized />
                    ) : (
                      <div className="flex aspect-square flex-col items-center justify-center gap-2 text-gray-700">
                        <Upload className="h-5 w-5" />
                        <span className="text-xs font-medium">Upload</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept={getAcceptedImageFormats()}
                      disabled={isSaving}
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) void handleUpload(view, file);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PawPrint className="h-4 w-4" />}
            Save pet asset
          </button>
        </form>
      </div>
    </div>
  );
}
