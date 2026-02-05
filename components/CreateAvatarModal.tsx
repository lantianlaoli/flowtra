'use client';

import { useEffect, useRef, useState } from 'react';
import { X, UserCircle, Upload, Loader2, Plus, AlertCircle, CircleHelp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserAvatar } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';

interface CreateAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAvatarCreated: (avatar: UserAvatar) => void;
}

const GOOD_EXAMPLE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/user-photos/character_ad_example.png';
const BLURRY_EXAMPLE_URL = 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/competitor_videos/user-photos/character_ad_bad.png';

interface PreviewFile {
  file: File;
  preview: string;
}

export default function CreateAvatarModal({
  isOpen,
  onClose,
  onAvatarCreated
}: CreateAvatarModalProps) {
  const [avatarName, setAvatarName] = useState('');
  const [primaryImage, setPrimaryImage] = useState<PreviewFile | null>(null);
  const [referenceImages, setReferenceImages] = useState<PreviewFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUploadingRefs, setIsUploadingRefs] = useState(false);

  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const referenceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAvatarName('');
      setPrimaryImage(null);
      setReferenceImages([]);
      setError(null);
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
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to load image.');
    } finally {
      event.target.value = '';
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, idx) => idx !== index));
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

  const canSubmit = Boolean(avatarName.trim() && primaryImage && !isCreating && !isUploadingRefs);

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
                  <p className="assets-modal-subtitle text-sm text-gray-600">Add 1 primary portrait and up to 3 reference photos.</p>
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
                <label htmlFor="avatar-name-input" className="assets-modal-label text-sm font-medium text-gray-700">Avatar Name</label>
                <input
                  id="avatar-name-input"
                  type="text"
                  value={avatarName}
                  onChange={(event) => setAvatarName(event.target.value)}
                  className="assets-modal-input mt-2 w-full rounded-xl border border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm text-gray-900 transition-all focus:border-black focus:bg-white focus:outline-none focus:ring-0"
                  placeholder="Enter avatar name"
                  maxLength={255}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-5">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium leading-5 text-gray-900">Primary Portrait (Required)</p>
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
                      'relative w-full aspect-[4/5] max-h-[560px] overflow-hidden rounded-2xl border-2 border-dashed transition',
                      primaryImage ? 'border-gray-300 bg-[#F8F8F8]' : 'border-gray-300 bg-[#FAFAFA] hover:border-gray-400'
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
                          className="absolute right-3 top-3 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
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

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-900">Reference Photos (Optional)</p>
                  <p className="text-xs text-gray-500">Recommended: one 45° side angle and 1–2 detail/profile shots.</p>

                  <div className="grid grid-cols-2 gap-3">
                    {referenceImages.map((item, index) => (
                      <div key={`reference-${index}`} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50 group">
                        <Image src={item.preview} alt={`Reference ${index + 1}`} fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => removeReferenceImage(index)}
                          className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {referenceImages.length < 3 && (
                      <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 bg-[#FAFAFA] flex flex-col items-center justify-center text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition cursor-pointer">
                        <input
                          ref={referenceInputRef}
                          type="file"
                          accept={getAcceptedImageFormats()}
                          onChange={handleReferenceUpload}
                          className="hidden"
                          disabled={isCreating || isUploadingRefs}
                        />
                        <Plus className="h-5 w-5 mb-2 text-gray-400" />
                        <span className="text-xs font-medium">Add Reference</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="assets-modal-actions flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="assets-modal-secondary flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
                  disabled={isCreating || isUploadingRefs}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="assets-modal-primary flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {(isCreating || isUploadingRefs) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isUploadingRefs ? 'Uploading references...' : isCreating ? 'Creating...' : 'Create Avatar'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
