'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Plus } from 'lucide-react';
import Image from 'next/image';
import { UserPhoto } from '@/lib/supabase';

interface UserPhotoGalleryProps {
  onPhotoSelect: (photoUrl: string) => void;
  selectedPhotoUrl?: string;
}

interface DefaultPhoto {
  id: string;
  photo_url: string;
  file_name: string;
}

// Default photos that are always available
const DEFAULT_PHOTOS: DefaultPhoto[] = [
  {
    id: 'default-male',
    photo_url: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/user-photos/user_default_male.png',
    file_name: 'Default Male'
  },
  {
    id: 'default-female',
    photo_url: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/user-photos/user_default_female.png',
    file_name: 'Default Female'
  },
  {
    id: 'default-founder',
    photo_url: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/user-photos/user_default_founder.png',
    file_name: 'Default Founder'
  }
];

export default function UserPhotoGallery({ onPhotoSelect, selectedPhotoUrl }: UserPhotoGalleryProps) {
  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Load user photos on component mount
  useEffect(() => {
    loadUserPhotos();
  }, []);

  const loadUserPhotos = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user-photos');
      if (response.ok) {
        const data = await response.json();
        setPhotos(data.photos || []);
      } else {
        console.error('Failed to load user photos');
      }
    } catch (error) {
      console.error('Error loading user photos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file (JPG, PNG, WebP, etc.)');
      return;
    }

    // Validate file size (8MB max - increased limit)
    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(`Image must be smaller than 8MB (current: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }

    // Validate image format more specifically
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setUploadError(`Unsupported image format. Please use JPG, PNG, WebP, or GIF`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const uploadWithRetry = async (retryCount = 0): Promise<void> => {
      try {
        const formData = new FormData();
        formData.append('file', file);

        // Add timeout to the request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch('/api/user-photos', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          // Refresh the photos list
          await loadUserPhotos();
          // Auto-select the newly uploaded photo
          onPhotoSelect(data.imageUrl);
          return;
        } else {
          // Try to parse error response
          let errorMessage = 'Upload failed';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.details || `Server error (${response.status})`;
          } catch {
            errorMessage = `Upload failed with status ${response.status}`;
          }

          // Retry on server errors (5xx) up to 2 times
          if (response.status >= 500 && retryCount < 2) {
            console.log(`Upload failed with ${response.status}, retrying... (${retryCount + 1}/2)`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Progressive delay
            return uploadWithRetry(retryCount + 1);
          }

          throw new Error(errorMessage);
        }
      } catch (error: unknown) {
        // Retry on network errors up to 2 times
        const errorObj = error as Error;
        if (errorObj.name === 'AbortError') {
          throw new Error('Upload timed out. Please try again with a smaller image.');
        }

        if ((errorObj.name === 'TypeError' || errorObj.message?.includes('fetch')) && retryCount < 2) {
          console.log(`Network error, retrying... (${retryCount + 1}/2)`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return uploadWithRetry(retryCount + 1);
        }

        throw error;
      }
    };

    try {
      await uploadWithRetry();
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const errorObj = error as Error;
      const errorMessage = errorObj.message || 'Upload failed, please try again';
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/user-photos?photoId=${photoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Remove from local state
        setPhotos(photos.filter(photo => photo.id !== photoId));
        // If this was the selected photo, clear selection
        const deletedPhoto = photos.find(photo => photo.id === photoId);
        if (deletedPhoto && selectedPhotoUrl === deletedPhoto.photo_url) {
          onPhotoSelect('');
        }
      } else {
        console.error('Failed to delete photo');
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Error */}
      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {uploadError}
        </div>
      )}

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Default Photos */}
        {DEFAULT_PHOTOS.map((photo) => (
          <div key={photo.id} className="relative group">
            <div
              className={`
                  relative w-full aspect-square rounded-lg overflow-hidden border-4 cursor-pointer
                  transition-all duration-200
                  ${selectedPhotoUrl === photo.photo_url
                    ? 'border-blue-500 shadow-lg ring-4 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              onClick={() => onPhotoSelect(photo.photo_url)}
            >
              <Image
                src={photo.photo_url}
                alt={photo.file_name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
            </div>
          </div>
        ))}

        {/* Existing Photos */}
        {photos.map((photo) => (
          <div key={photo.id} className="relative group">
            <div
              className={`
                  relative w-full aspect-square rounded-lg overflow-hidden border-4 cursor-pointer
                  transition-all duration-200
                  ${selectedPhotoUrl === photo.photo_url
                    ? 'border-blue-500 shadow-lg ring-4 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
                onClick={() => onPhotoSelect(photo.photo_url)}
              >
                <Image
                  src={photo.photo_url}
                  alt={photo.file_name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
              </div>

              {/* Delete Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePhoto(photo.id);
                }}
                className="
                  absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full
                  flex items-center justify-center opacity-0 group-hover:opacity-100
                  transition-opacity duration-200 hover:bg-red-600
                "
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Upload New Photo Card */}
          <div className="relative">
            <label
              className={`
                block w-full aspect-square border-2 border-dashed border-gray-300 rounded-lg
                hover:border-gray-400 transition-colors cursor-pointer
                ${isUploading ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              <div className="flex flex-col items-center justify-center h-full p-4">
                {isUploading ? (
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin mb-2" />
                ) : (
                  <Plus className="w-8 h-8 text-gray-400 mb-2" />
                )}
                {isUploading && (
                  <span className="text-sm text-gray-500 text-center">
                    Uploading...
                  </span>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
              />
            </label>
          </div>
        </div>
      </div>
  );
}
