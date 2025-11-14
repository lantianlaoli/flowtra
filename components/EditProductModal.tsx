'use client';

import { useState, useEffect } from 'react';
import { X, Package, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserProduct } from '@/lib/supabase';

interface EditProductModalProps {
  isOpen: boolean;
  product: UserProduct | null;
  onClose: () => void;
  onProductUpdated: (product: UserProduct) => void;
}

export default function EditProductModal({
  isOpen,
  product,
  onClose,
  onProductUpdated
}: EditProductModalProps) {
  const [productName, setProductName] = useState('');
  const [productDetails, setProductDetails] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when product or modal opens
  useEffect(() => {
    if (isOpen && product) {
      setProductName(product.product_name);
      setProductDetails(product.product_details || '');
      setError(null);
      // Auto focus input after modal animation
      setTimeout(() => {
        const input = document.querySelector('#edit-product-name-input') as HTMLInputElement;
        if (input) input.focus();
      }, 150);
    }
  }, [isOpen, product]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!product) return;

    if (!productName.trim()) {
      setError('Product name is required');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      // Check if anything changed
      const hasChanges =
        productName.trim() !== product.product_name ||
        productDetails.trim() !== (product.product_details || '');

      if (!hasChanges) {
        onClose();
        return;
      }

      // Use JSON for text-only updates
      const response = await fetch(`/api/user-products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productName.trim(),
          product_details: productDetails.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update product');
      }

      const data = await response.json();
      onProductUpdated(data.product);
      onClose();
    } catch (error) {
      console.error('Error updating product:', error);
      setError(error instanceof Error ? error.message : 'Failed to update product. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isUpdating) {
      onClose();
    }
  };

  if (!product) return null;

  // Get product photo URL
  const productPhotoUrl = product.user_product_photos?.[0]?.photo_url;

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
                  <h3 className="text-lg font-semibold text-gray-900">Edit Product</h3>
                  <p className="text-sm text-gray-600">Update product information</p>
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
              {/* Product Name Input */}
              <div>
                <label htmlFor="edit-product-name-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Product Name *
                </label>
                <input
                  id="edit-product-name-input"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors"
                  placeholder="Enter product name"
                  disabled={isUpdating}
                  maxLength={100}
                />
              </div>

              {/* Product Details Input */}
              <div>
                <label htmlFor="edit-product-details-input" className="block text-sm font-medium text-gray-700 mb-2">
                  Product Description (Optional)
                </label>
                <textarea
                  id="edit-product-details-input"
                  value={productDetails}
                  onChange={(e) => setProductDetails(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors min-h-24"
                  placeholder="Describe your product, key features, target audience, benefits, etc."
                  disabled={isUpdating}
                  maxLength={2000}
                />
                <p className="mt-1 text-xs text-gray-500">Used to provide context when generating ads.</p>
              </div>

              {/* Product Photo Preview (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Photo
                </label>
                <div className="w-full h-32 bg-gray-50 rounded-lg border-2 border-gray-200 flex items-center justify-center p-4 overflow-hidden">
                  {productPhotoUrl ? (
                    <Image
                      src={productPhotoUrl}
                      alt={productName}
                      width={200}
                      height={200}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <ImageIcon className="w-6 h-6 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">No photo uploaded</p>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  To change the photo, go back to Assets and use the photo management tools.
                </p>
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
                  disabled={isUpdating || !productName.trim()}
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
