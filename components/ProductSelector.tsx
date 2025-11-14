'use client';

import { useState, useEffect } from 'react';
import { Package, Tag, ChevronRight } from 'lucide-react';
import { UserProduct, UserBrand } from '@/lib/supabase';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

// Exported for backward compatibility (no longer used in this component)
export interface TemporaryProduct extends Omit<UserProduct, 'id'> {
  id: string;
  isTemporary: true;
  uploadedFiles: File[];
}

interface ProductSelectorProps {
  selectedProduct: UserProduct | null;
  onProductSelect: (product: UserProduct | null) => void;
}

export default function ProductSelector({
  selectedProduct,
  onProductSelect
}: ProductSelectorProps) {
  const [brands, setBrands] = useState<UserBrand[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<UserBrand | null>(null);
  const [brandProducts, setBrandProducts] = useState<UserProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'brand-selection' | 'product-selection' | 'review'>(
    selectedProduct ? 'review' : 'brand-selection'
  );

  // Load brands on mount
  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/brands');
      const data = await response.json();

      if (data.success && Array.isArray(data.brands)) {
        setBrands(data.brands);
      }
    } catch (error) {
      console.error('Error loading brands:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBrandProducts = async (brandId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/brands/${brandId}/products`);
      const data = await response.json();

      if (data.success && Array.isArray(data.products)) {
        setBrandProducts(data.products);
      }
    } catch (error) {
      console.error('Error loading brand products:', error);
      setBrandProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrandSelect = async (brand: UserBrand) => {
    setSelectedBrand(brand);
    await loadBrandProducts(brand.id);
    setStep('product-selection');
  };

  const handleProductSelect = (product: UserProduct) => {
    // Attach brand to product for parent component
    const productWithBrand = { ...product, brand: selectedBrand };
    onProductSelect(productWithBrand as UserProduct);
    setStep('review');
  };

  const handleChangeSelection = () => {
    onProductSelect(null);
    setSelectedBrand(null);
    setBrandProducts([]);
    setStep('brand-selection');
  };

  // Brand Selection Step
  const renderBrandSelection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">Select Brand</div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-black"></div>
        </div>
      ) : brands.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center">
          <Tag className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">No brands found</p>
          <p className="mt-1 text-xs text-gray-500">Create a brand first to add products</p>
        </div>
      ) : (
        <div className="space-y-2">
          {brands.map((brand) => (
            <button
              key={brand.id}
              onClick={() => handleBrandSelect(brand)}
              className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-gray-300 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {brand.brand_logo_url ? (
                  <Image
                    src={brand.brand_logo_url}
                    alt={brand.brand_name}
                    width={40}
                    height={40}
                    className="rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100">
                    <Tag className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{brand.brand_name}</div>
                  <div className="text-xs text-gray-500 truncate">{brand.brand_slogan || brand.brand_details || 'No slogan'}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Product Selection Step
  const renderProductSelection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-900">
          Select Product from {selectedBrand?.brand_name}
        </div>
        <button
          onClick={() => setStep('brand-selection')}
          className="text-xs text-gray-600 hover:text-gray-900"
        >
          ← Change Brand
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-black"></div>
        </div>
      ) : brandProducts.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center">
          <Package className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">No products in this brand</p>
          <p className="mt-1 text-xs text-gray-500">Add products to this brand to continue</p>
        </div>
      ) : (
        <div className="space-y-2">
          {brandProducts.map((product) => {
            const primaryPhoto = product.user_product_photos?.find(p => p.is_primary);
            const photo = primaryPhoto || product.user_product_photos?.[0];

            return (
              <button
                key={product.id}
                onClick={() => handleProductSelect(product)}
                className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition hover:border-gray-300 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {photo?.photo_url ? (
                    <Image
                      src={photo.photo_url}
                      alt={product.product_name}
                      width={40}
                      height={40}
                      className="rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100">
                      <Package className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{product.product_name}</div>
                    {(product.product_details || product.description) && (
                      <div className="text-xs text-gray-500 truncate">{product.product_details || product.description}</div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // Review Step
  const renderReview = () => {
    if (!selectedProduct) return null;

    const primaryPhoto = selectedProduct.user_product_photos?.find(p => p.is_primary);
    const photo = primaryPhoto || selectedProduct.user_product_photos?.[0];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Selected Product</div>
          <button
            onClick={handleChangeSelection}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            Change Selection
          </button>
        </div>

        <div className="rounded-lg border border-gray-300 bg-white p-4">
          <div className="flex items-center gap-4">
            {photo?.photo_url ? (
              <Image
                src={photo.photo_url}
                alt={selectedProduct.product_name}
                width={64}
                height={64}
                className="rounded-md object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-gray-100">
                <Package className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900">{selectedProduct.product_name}</div>
              {(selectedProduct.product_details || selectedProduct.description) && (
                <div className="mt-1 text-xs text-gray-600 line-clamp-2">{selectedProduct.product_details || selectedProduct.description}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-base font-medium text-gray-900">
        <Package className="h-4 w-4" />
        Product Selection
      </div>

      <AnimatePresence mode="wait">
        {step === 'brand-selection' && (
          <motion.div
            key="brand-selection"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {renderBrandSelection()}
          </motion.div>
        )}

        {step === 'product-selection' && (
          <motion.div
            key="product-selection"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {renderProductSelection()}
          </motion.div>
        )}

        {step === 'review' && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {renderReview()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
