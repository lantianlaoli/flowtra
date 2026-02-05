'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, UserCircle, Loader2, Plus, ArrowUpCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  type AvatarPhotoEntry,
  type AvatarPhotoSet,
  normalizeAvatarPhotoSet,
  type UserAvatar
} from '@/lib/supabase';
import { getAcceptedImageFormats, validateImageFormat, IMAGE_CONVERSION_LINK } from '@/lib/image-validation';

interface EditAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  avatar: UserAvatar | null;
  onAvatarUpdated: (avatar: UserAvatar) => void;
}

type PreviewTarget =
  | { kind: 'primary' }
  | { kind: 'reference'; index: number };

function getPreviewImage(photoSet: AvatarPhotoSet, target: PreviewTarget) {
  if (target.kind === 'primary') {
    return photoSet.primary;
  }
  return photoSet.references[target.index] || photoSet.primary;
}

export default function EditAvatarModal({
  isOpen,
  onClose,
  avatar,
  onAvatarUpdated
}: EditAvatarModalProps) {
  const [avatarName, setAvatarName] = useState('');
  const [currentAvatar, setCurrentAvatar] = useState<UserAvatar | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>({ kind: 'primary' });
  const [isSaving, setIsSaving] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const primaryUploadInputRef = useRef<HTMLInputElement | null>(null);

  const photoSet = useMemo(() => {
    if (!currentAvatar) {
      return null;
    }
    return normalizeAvatarPhotoSet(
      currentAvatar.photo_set_json,
      currentAvatar.photo_url,
      currentAvatar.file_name
    );
  }, [currentAvatar]);

  const selectedPreview = useMemo(() => {
    if (!photoSet) {
      return null;
    }
    return getPreviewImage(photoSet, previewTarget);
  }, [photoSet, previewTarget]);

  useEffect(() => {
    if (isOpen && avatar) {
      setCurrentAvatar(avatar);
      setAvatarName(avatar.avatar_name);
      setPreviewTarget({ kind: 'primary' });
      setError(null);
      setTimeout(() => {
        const input = document.querySelector('#edit-avatar-name-input') as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.select();
        }
      }, 150);
    }
  }, [isOpen, avatar]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSaving, onClose]);

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
    action: 'rename' | 'replace_primary' | 'add_reference' | 'delete_reference' | 'promote_reference_to_primary';
    file?: File;
    referenceIndex?: number;
    nextName?: string;
  }) => {
    if (!currentAvatar) return;

    setIsSaving(true);
    setActiveAction(action);
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
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action,
            avatarName: nextName,
            referenceIndex
          })
        });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update avatar');
      }

      setCurrentAvatar(payload.avatar);
      onAvatarUpdated(payload.avatar);

      if (action === 'delete_reference') {
        setPreviewTarget({ kind: 'primary' });
      }
      if (action === 'promote_reference_to_primary' || action === 'replace_primary') {
        setPreviewTarget({ kind: 'primary' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update avatar.');
    } finally {
      setIsSaving(false);
      setActiveAction(null);
    }
  };

  const handleSaveChanges = async () => {
    if (!currentAvatar) return;

    const trimmedName = avatarName.trim();
    if (!trimmedName) {
      setError('Avatar name is required');
      return;
    }

    if (trimmedName === currentAvatar.avatar_name) {
      onClose();
      return;
    }

    await runAvatarAction({
      action: 'rename',
      nextName: trimmedName
    });

    onClose();
  };

  const handlePrimaryReplace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      setError(validationResult.error);
      event.target.value = '';
      return;
    }

    await runAvatarAction({
      action: 'replace_primary',
      file
    });

    event.target.value = '';
  };

  const handleAddReference = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationResult = validateImageFormat(file);
    if (!validationResult.isValid) {
      setError(validationResult.error);
      event.target.value = '';
      return;
    }

    if ((photoSet?.references.length || 0) >= 3) {
      setError('You can add up to 3 reference photos.');
      event.target.value = '';
      return;
    }

    await runAvatarAction({
      action: 'add_reference',
      file
    });

    event.target.value = '';
  };

  const handleDeleteReference = async (index: number) => {
    await runAvatarAction({
      action: 'delete_reference',
      referenceIndex: index
    });
  };

  const handlePromoteReference = async (index: number) => {
    await runAvatarAction({
      action: 'promote_reference_to_primary',
      referenceIndex: index
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSaving) {
      onClose();
    }
  };

  if (!avatar || !currentAvatar || !photoSet) return null;

  return (
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
            className="assets-modal-panel assets-edit-avatar-panel relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-5xl mx-auto overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="assets-modal-header flex items-center justify-between p-5 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="assets-modal-icon w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="assets-modal-title text-lg font-semibold text-gray-900">Edit Avatar</h3>
                  <p className="assets-modal-subtitle text-sm text-gray-600">Manage avatar name and photos in one place.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="assets-modal-close w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isSaving}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]">
              <div className="border-r border-gray-200 bg-gray-50">
                {selectedPreview ? (
                  <div className="aspect-square relative">
                    <Image
                      src={selectedPreview.photo_url}
                      alt={currentAvatar.avatar_name}
                      fill
                      className="object-contain"
                      sizes="(max-width: 1024px) 100vw, 60vw"
                    />
                  </div>
                ) : (
                  <div className="aspect-square flex items-center justify-center text-sm text-gray-400">No photo</div>
                )}
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <label htmlFor="edit-avatar-name-input" className="block text-sm font-medium text-gray-700 mb-2">
                    Avatar Name
                  </label>
                  <input
                    id="edit-avatar-name-input"
                    type="text"
                    value={avatarName}
                    onChange={(e) => setAvatarName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Enter avatar name"
                    disabled={isSaving}
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Primary Photo</p>
                  <p className="text-xs text-gray-500">Front-facing, well-lit portrait.</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div
                      className={`relative group aspect-square rounded-lg overflow-hidden cursor-pointer border ${previewTarget.kind === 'primary' ? 'border-gray-900' : 'border-gray-200'}`}
                      onClick={() => setPreviewTarget({ kind: 'primary' })}
                    >
                      <Image src={photoSet.primary.photo_url} alt={photoSet.primary.file_name} fill className="object-cover" sizes="120px" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="inline-flex items-center gap-1 text-xs text-white">
                          {activeAction === 'replace_primary' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Replace
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          primaryUploadInputRef.current?.click();
                        }}
                        className="absolute inset-0"
                        aria-label="Replace primary photo"
                      />
                    </div>
                    <input
                      ref={primaryUploadInputRef}
                      type="file"
                      accept={getAcceptedImageFormats()}
                      onChange={handlePrimaryReplace}
                      className="hidden"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Reference Photos</p>
                  <p className="text-xs text-gray-500">Recommended: 45° side angle and detail/profile shots for expression and structure consistency.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {photoSet.references.map((photo, index) => (
                      <div
                        key={`${photo.photo_url}-${index}`}
                        className={`relative group aspect-square rounded-lg overflow-hidden border ${previewTarget.kind === 'reference' && previewTarget.index === index ? 'border-gray-900' : 'border-gray-200'}`}
                      >
                        <button
                          type="button"
                          className="absolute inset-0"
                          onClick={() => setPreviewTarget({ kind: 'reference', index })}
                        >
                          <Image src={photo.photo_url} alt={photo.file_name} fill className="object-cover" sizes="120px" />
                        </button>

                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handlePromoteReference(index);
                            }}
                            className="w-6 h-6 bg-black/70 text-white rounded-full flex items-center justify-center"
                            title="Promote to primary"
                          >
                            {activeAction === 'promote_reference_to_primary' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleDeleteReference(index);
                            }}
                            className="w-6 h-6 bg-black/70 text-white rounded-full flex items-center justify-center"
                            title="Delete reference"
                          >
                            {activeAction === 'delete_reference' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    ))}

                    {photoSet.references.length < 3 && (
                      <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
                        <input
                          type="file"
                          accept={getAcceptedImageFormats()}
                          onChange={handleAddReference}
                          className="hidden"
                          disabled={isSaving}
                        />
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          {activeAction === 'add_reference' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Add
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600">{renderErrorMessage(error)}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveChanges()}
                    disabled={isSaving || !avatarName.trim()}
                    className="flex-1 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {activeAction === 'rename' && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
