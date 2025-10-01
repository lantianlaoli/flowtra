'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Package, Plus, Upload } from 'lucide-react';
import { UserProduct } from '@/lib/supabase';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export interface TemporaryProduct extends Omit<UserProduct, 'id'> {
  id: string;
  isTemporary: true;
  uploadedFiles: File[];
}

interface ProductSelectorProps {
  selectedProduct: UserProduct | TemporaryProduct | null;
  onProductSelect: (product: UserProduct | TemporaryProduct | null) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Create temporary product object
    const filesArray = Array.from(files);
    const tempPhotoUrls = filesArray.map(file => URL.createObjectURL(file));

    const temporaryProduct: TemporaryProduct = {
      id: `temp-${Date.now()}`,
      isTemporary: true,
      uploadedFiles: filesArray,
      product_name: 'Uploaded Images',
      description: `${filesArray.length} image${filesArray.length > 1 ? 's' : ''} uploaded`,
      user_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_product_photos: tempPhotoUrls.map((url, index) => ({
        id: `temp-photo-${index}`,
        product_id: `temp-${Date.now()}`,
        user_id: '',
        photo_url: url,
        file_name: `temp-${index}`,
        is_primary: index === 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    };

    onProductSelect(temporaryProduct);
    setIsOpen(false);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isTemporaryProduct = (product: UserProduct | TemporaryProduct | null): product is TemporaryProduct => {
    return product !== null && 'isTemporary' in product && product.isTemporary === true;
  };

  const selectedPhotos = selectedProduct?.user_product_photos || [];
  const primaryPhoto = selectedPhotos.find(photo => photo.is_primary) || selectedPhotos[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Product
      </label>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

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
                <div className="font-medium text-gray-900">
                  {selectedProduct.product_name}
                  {isTemporaryProduct(selectedProduct) && (
                    <span className="ml-2 text-xs text-blue-600">(Temporary)</span>
                  )}
                </div>
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
            {/* Upload Images Button */}
            <button
              onClick={() => {
                fileInputRef.current?.click();
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 text-blue-600 font-medium transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                  <Upload className="w-4 h-4 text-blue-600" />
                </div>
                <span>Upload Images Directly</span>
              </div>
            </button>

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