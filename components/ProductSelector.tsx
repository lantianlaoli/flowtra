'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Package, Plus } from 'lucide-react';
import { UserProduct } from '@/lib/supabase';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductSelectorProps {
  selectedProduct: UserProduct | null;
  onProductSelect: (product: UserProduct | null) => void;
  onManageProducts: () => void;
}

export default function ProductSelector({
  selectedProduct,
  onProductSelect,
  onManageProducts
}: ProductSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user-products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPhotos = selectedProduct?.user_product_photos || [];
  const primaryPhoto = selectedPhotos.find(photo => photo.is_primary) || selectedPhotos[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Product
      </label>

      {/* Selector Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors bg-white"
      >
        <div className="flex items-center gap-3">
          {selectedProduct ? (
            <>
              {primaryPhoto ? (
                <div className="w-8 h-8 rounded overflow-hidden">
                  <Image
                    src={primaryPhoto.photo_url}
                    alt={selectedProduct.product_name}
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                  <Package className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div className="text-left">
                <div className="font-medium text-gray-900">{selectedProduct.product_name}</div>
                <div className="text-xs text-gray-500">
                  {selectedPhotos.length} {selectedPhotos.length === 1 ? 'photo' : 'photos'}
                </div>
              </div>
            </>
          ) : (
            <>
              <Package className="w-5 h-5 text-gray-400" />
              <span className="text-gray-500">Choose a product...</span>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-80 overflow-auto"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* Clear Selection */}
            {selectedProduct && (
              <button
                onClick={() => {
                  onProductSelect(null);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 text-gray-600"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 border border-gray-300 rounded flex items-center justify-center">
                    <span className="text-gray-400 text-xs">×</span>
                  </div>
                  <span>No product selected</span>
                </div>
              </button>
            )}

            {/* Products List */}
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                Loading products...
              </div>
            ) : products.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <div className="text-sm">No products found</div>
                <button
                  onClick={() => {
                    onManageProducts();
                    setIsOpen(false);
                  }}
                  className="mt-2 text-xs text-gray-900 hover:underline"
                >
                  Create your first product
                </button>
              </div>
            ) : (
              <>
                {products.map((product) => {
                  const photos = product.user_product_photos || [];
                  const primaryPhoto = photos.find(photo => photo.is_primary) || photos[0];
                  const isSelected = selectedProduct?.id === product.id;

                  return (
                    <button
                      key={product.id}
                      onClick={() => {
                        onProductSelect(product);
                        setIsOpen(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-gray-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {primaryPhoto ? (
                          <div className="w-10 h-10 rounded overflow-hidden">
                            <Image
                              src={primaryPhoto.photo_url}
                              alt={product.product_name}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {product.product_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                            {product.description && (
                              <>
                                {' • '}
                                <span className="truncate">{product.description}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Manage Products Button */}
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => {
                      onManageProducts();
                      setIsOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 text-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Plus className="w-5 h-5" />
                      <span className="text-sm">Manage Products</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}