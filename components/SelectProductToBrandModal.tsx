'use client';

import { useState, useEffect } from 'react';
import { X, Package, CheckCircle2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { UserProduct } from '@/lib/supabase';

interface SelectProductToBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  brandName: string;
  availableProducts: UserProduct[];
  onProductsSelected: (productIds: string[]) => void;
}

export default function SelectProductToBrandModal({
  isOpen,
  onClose,
  brandName,
  availableProducts,
  onProductsSelected
}: SelectProductToBrandModalProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Reset selection when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedProductIds(new Set());
      setSearchTerm('');
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

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSubmit = () => {
    if (selectedProductIds.size > 0) {
      onProductsSelected(Array.from(selectedProductIds));
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const filteredProducts = availableProducts.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

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
            className="relative bg-white rounded-xl shadow-lg border border-gray-200 w-full max-w-2xl mx-auto max-h-[80vh] flex flex-col"
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
                  <h3 className="text-lg font-semibold text-gray-900">
                    Add Products to &quot;{brandName}&quot;
                  </h3>
                  <p className="text-sm text-gray-600">
                    Select from unbranded products ({availableProducts.length} available)
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            </div>

            {/* Products List (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">
                    {searchTerm ? 'No products found' : 'No unbranded products available'}
                  </h3>
                  <p className="text-sm">
                    {searchTerm ? 'Try adjusting your search terms' : 'All products are already assigned to brands'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((product) => {
                    const isSelected = selectedProductIds.has(product.id);
                    const photos = product.user_product_photos || [];

                    return (
                      <div
                        key={product.id}
                        onClick={() => toggleProduct(product.id)}
                        className={`
                          p-4 border-2 rounded-lg cursor-pointer transition-all duration-200
                          ${isSelected
                            ? 'border-gray-900 bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className="flex items-center gap-4">
                          {/* Checkbox */}
                          <div
                            className={`
                              w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                              ${isSelected
                                ? 'bg-gray-900 border-gray-900'
                                : 'border-gray-300'
                              }
                            `}
                          >
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-white" />
                            )}
                          </div>

                          {/* Thumbnail */}
                          {photos.length > 0 ? (
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <Image
                                src={photos[0].photo_url}
                                alt={product.product_name}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                              {photos.length > 1 && (
                                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                                  +{photos.length - 1}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 flex-shrink-0">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {product.product_name}
                            </h4>
                            {product.description && (
                              <p className="text-gray-600 text-sm line-clamp-2 mt-0.5">
                                {product.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  {selectedProductIds.size} {selectedProductIds.size === 1 ? 'product' : 'products'} selected
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={selectedProductIds.size === 0}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add {selectedProductIds.size > 0 && `(${selectedProductIds.size})`} to Brand
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
