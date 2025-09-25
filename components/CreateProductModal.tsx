'use client';

import { useState, useEffect } from 'react';
import { X, Package, Upload, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserProduct } from '@/lib/supabase';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductCreated: (product: UserProduct) => void;
}

export default function CreateProductModal({
  isOpen,
  onClose,
  onProductCreated
}: CreateProductModalProps) {
  const [productName, setProductName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setProductName('');
      setError(null);
      setUploadedImage(null);
      setImagePreview(null);
      // Auto focus input after modal animation
      setTimeout(() => {
        const input = document.querySelector('#product-name-input') as HTMLInputElement;
        if (input) input.focus();
      }, 150);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Product name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // First create the product
      const response = await fetch('/api/user-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_name: productName.trim() })
      });

      if (!response.ok) {
        throw new Error('Failed to create product');
      }

      const data = await response.json();
      const newProduct = data.product;

      // If there's an uploaded image, upload it as the first photo
      if (uploadedImage) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', uploadedImage);
        formData.append('is_primary', 'true');

        const photoResponse = await fetch(`/api/user-products/${newProduct.id}/photos`, {
          method: 'POST',
          body: formData
        });

        if (photoResponse.ok) {
          const photoData = await photoResponse.json();
          // Update the product with the uploaded photo
          newProduct.user_product_photos = [photoData.photo];
        }
      }

      onProductCreated(newProduct);
      onClose();
    } catch (error) {
      console.error('Error creating product:', error);
      setError('Failed to create product. Please try again.');
    } finally {
      setIsCreating(false);
      setIsUploading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Create New Product</h3>
                  <p className="text-sm text-gray-600">Enter your product name to get started</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                disabled={isCreating}
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Product Name Input */}
              <div>
                <label htmlFor="product-name-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  id="product-name-input"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                  placeholder="Enter product name"
                  disabled={isCreating}
                  maxLength={100}
                />
                {error && (
                  <p className="mt-1 text-sm text-red-600">{error}</p>
                )}
              </div>

              {/* Optional Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Image (Optional)
                </label>
                <div className="space-y-3">
                  {imagePreview ? (
                    <div className="relative">
                      <Image
                        src={imagePreview}
                        alt="Product preview"
                        width={400}
                        height={128}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedImage(null);
                          setImagePreview(null);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                        disabled={isCreating}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isCreating}
                      />
                      <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-gray-400 cursor-pointer transition-colors">
                        <Upload className="w-6 h-6 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Click to upload image</p>
                        <p className="text-xs text-gray-500">PNG, JPG up to 8MB</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !productName.trim()}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isCreating && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {isCreating
                    ? (isUploading ? 'Uploading...' : 'Creating...')
                    : 'Create Product'
                  }
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}