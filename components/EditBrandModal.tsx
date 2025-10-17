'use client';

import { useState, useEffect } from 'react';
import { X, Tag, Upload, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserBrand } from '@/lib/supabase';

interface EditBrandModalProps {
  isOpen: boolean;
  brand: UserBrand | null;
  onClose: () => void;
  onBrandUpdated: (brand: UserBrand) => void;
}

export default function EditBrandModal({
  isOpen,
  brand,
  onClose,
  onBrandUpdated
}: EditBrandModalProps) {
  const [brandName, setBrandName] = useState('');
  const [brandSlogan, setBrandSlogan] = useState('');
  const [newLogoFile, setNewLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when brand or modal opens
  useEffect(() => {
    if (isOpen && brand) {
      setBrandName(brand.brand_name);
      setBrandSlogan(brand.brand_slogan || '');
      setLogoPreview(brand.brand_logo_url);
      setNewLogoFile(null);
      setError(null);
      // Auto focus input after modal animation
      setTimeout(() => {
        const input = document.querySelector('#edit-brand-name-input') as HTMLInputElement;
        if (input) input.focus();
      }, 150);
    }
  }, [isOpen, brand]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isUpdating) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isUpdating, onClose]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo file size must be less than 5MB');
        return;
      }
      setNewLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!brand) return;

    if (!brandName.trim()) {
      setError('Brand name is required');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      // Check if anything changed
      const hasChanges =
        brandName.trim() !== brand.brand_name ||
        brandSlogan.trim() !== (brand.brand_slogan || '') ||
        newLogoFile !== null;

      if (!hasChanges) {
        onClose();
        return;
      }

      let response;

      if (newLogoFile) {
        // If new logo, use multipart/form-data
        const formData = new FormData();
        formData.append('brand_name', brandName.trim());
        formData.append('brand_slogan', brandSlogan.trim());
        formData.append('logo', newLogoFile);

        response = await fetch(`/api/user-brands/${brand.id}`, {
          method: 'PUT',
          body: formData
        });
      } else {
        // If no new logo, use JSON
        response = await fetch(`/api/user-brands/${brand.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand_name: brandName.trim(),
            brand_slogan: brandSlogan.trim()
          })
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update brand');
      }

      const data = await response.json();
      onBrandUpdated(data.brand);
      onClose();
    } catch (error) {
      console.error('Error updating brand:', error);
      setError(error instanceof Error ? error.message : 'Failed to update brand. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isUpdating) {
      onClose();
    }
  };

  if (!brand) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleBackdropClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Card */}
          <motion.div
            className="relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-md mx-auto"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                  <Tag className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Edit Brand</h3>
                  <p className="text-sm text-gray-600">Update brand information</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isUpdating}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Brand Name Input */}
              <div>
                <label htmlFor="edit-brand-name-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Name *
                </label>
                <input
                  id="edit-brand-name-input"
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                  placeholder="Enter brand name"
                  disabled={isUpdating}
                  maxLength={100}
                />
              </div>

              {/* Brand Slogan Input */}
              <div>
                <label htmlFor="edit-brand-slogan-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Slogan (Optional)
                </label>
                <input
                  id="edit-brand-slogan-input"
                  type="text"
                  value={brandSlogan}
                  onChange={(e) => setBrandSlogan(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                  placeholder="Enter brand slogan"
                  disabled={isUpdating}
                  maxLength={200}
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Logo {newLogoFile ? '(New)' : '(Click to replace)'}
                </label>
                <div className="space-y-3">
                  <label className="block relative group cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={isUpdating}
                    />
                    <div className="w-full h-32 bg-gray-50 rounded-lg border-2 border-gray-200 group-hover:border-gray-400 flex items-center justify-center p-4 transition-colors overflow-hidden">
                      {logoPreview ? (
                        <Image
                          src={logoPreview}
                          alt="Brand logo preview"
                          width={200}
                          height={200}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="w-6 h-6 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Click to upload new logo</p>
                        </div>
                      )}
                    </div>
                    {logoPreview && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Upload className="w-6 h-6 text-gray-600" />
                        </div>
                      </div>
                    )}
                  </label>
                  <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isUpdating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || !brandName.trim()}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isUpdating && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {isUpdating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
