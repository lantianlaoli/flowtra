'use client';

import { useState, useEffect } from 'react';
import { Package, Building2, Check } from 'lucide-react';
import { UserProduct, UserBrand } from '@/lib/supabase';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandProductSelectorProps {
  selectedBrand: UserBrand | null;
  selectedProduct: UserProduct | null;
  onBrandSelect: (brand: UserBrand | null) => void;
  onProductSelect: (product: UserProduct | null) => void;
  className?: string;
}

export default function BrandProductSelector({
  selectedBrand,
  selectedProduct,
  onBrandSelect,
  onProductSelect,
  className
}: BrandProductSelectorProps) {
  const [brands, setBrands] = useState<UserBrand[]>([]);
  const [brandProducts, setBrandProducts] = useState<UserProduct[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Load brands on mount
  useEffect(() => {
    loadBrands();
  }, []);

  // Load products when brand changes
  useEffect(() => {
    if (selectedBrand) {
      loadBrandProducts(selectedBrand.id);
    } else {
      setBrandProducts([]);
      onProductSelect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand?.id]);

  const loadBrands = async () => {
    setIsLoadingBrands(true);
    try {
      const response = await fetch('/api/brands');
      const data = await response.json();

      if (data.success && Array.isArray(data.brands)) {
        setBrands(data.brands);
      }
    } catch (error) {
      console.error('Error loading brands:', error);
    } finally {
      setIsLoadingBrands(false);
    }
  };

  const loadBrandProducts = async (brandId: string) => {
    setIsLoadingProducts(true);
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
      setIsLoadingProducts(false);
    }
  };

  const handleBrandClick = (brand: UserBrand) => {
    if (selectedBrand?.id === brand.id) {
      onBrandSelect(null);
      onProductSelect(null);
    } else {
      onBrandSelect(brand);
      onProductSelect(null); // Reset product when changing brand
    }
  };

  const handleProductClick = (product: UserProduct) => {
    if (selectedProduct?.id === product.id) {
      onProductSelect(null);
    } else {
      // Attach brand to product
      const productWithBrand = { ...product, brand: selectedBrand };
      onProductSelect(productWithBrand as UserProduct);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-base font-medium text-gray-900">
        Brand & Product
      </div>

      {/* Left-Right Layout Container */}
      <div className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden">
        <div className="grid grid-cols-2 divide-x-2 divide-gray-300">
          {/* Left: Brand Selection */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Building2 className="w-4 h-4" />
              <span>Select Brand</span>
            </div>

            {isLoadingBrands ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-black"></div>
              </div>
            ) : brands.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No brands found
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {brands.map((brand) => {
                  const isSelected = selectedBrand?.id === brand.id;
                  return (
                    <button
                      key={brand.id}
                      onClick={() => handleBrandClick(brand)}
                      className={cn(
                        "w-full rounded-lg border-2 p-3 text-left transition-all",
                        "flex items-center gap-3",
                        isSelected
                          ? "border-black bg-gray-50"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      {/* Brand Logo */}
                      <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center border border-gray-300 flex-shrink-0 overflow-hidden">
                        {brand.brand_logo_url ? (
                          <Image
                            src={brand.brand_logo_url}
                            alt={brand.brand_name}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      {/* Brand Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {brand.brand_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {brand.brand_slogan || 'No slogan'}
                        </div>
                      </div>

                      {/* Check Icon */}
                      {isSelected && (
                        <Check className="w-5 h-5 text-black flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Product Selection */}
          <div className="p-4 space-y-3 bg-gray-50">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Package className="w-4 h-4" />
              <span>Select Product</span>
            </div>

            {!selectedBrand ? (
              <div className="text-center py-12 text-sm text-gray-500">
                Select a brand first
              </div>
            ) : isLoadingProducts ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-black"></div>
              </div>
            ) : brandProducts.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-500">
                No products in this brand
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {brandProducts.map((product) => {
                  const isSelected = selectedProduct?.id === product.id;
                  const primaryPhoto = product.user_product_photos?.find(p => p.is_primary);
                  const photo = primaryPhoto || product.user_product_photos?.[0];

                  return (
                    <button
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className={cn(
                        "w-full rounded-lg border-2 p-3 text-left transition-all",
                        "flex items-center gap-3",
                        isSelected
                          ? "border-black bg-white"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      )}
                    >
                      {/* Product Photo */}
                      <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center border border-gray-300 flex-shrink-0 overflow-hidden">
                        {photo?.photo_url ? (
                          <Image
                            src={photo.photo_url}
                            alt={product.product_name}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {product.product_name}
                        </div>
                        {product.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {product.description}
                          </div>
                        )}
                      </div>

                      {/* Check Icon */}
                      {isSelected && (
                        <Check className="w-5 h-5 text-black flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
