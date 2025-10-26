'use client';

import { useState, useEffect } from 'react';
import { Package, Building2, ChevronDown } from 'lucide-react';
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

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const brandId = e.target.value;
    if (brandId) {
      const brand = brands.find(b => b.id === brandId);
      onBrandSelect(brand || null);
      onProductSelect(null); // Reset product selection
    } else {
      onBrandSelect(null);
      onProductSelect(null);
    }
  };

  const handleProductChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const productId = e.target.value;
    if (productId) {
      const product = brandProducts.find(p => p.id === productId);
      if (product) {
        // Attach brand to product
        const productWithBrand = { ...product, brand: selectedBrand };
        onProductSelect(productWithBrand as UserProduct);
      }
    } else {
      onProductSelect(null);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 text-base font-medium text-gray-900">
        <Package className="h-4 w-4" />
        Brand & Product Selection
      </div>

      {/* Brand Dropdown */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Brand</label>
        <div className="relative">
          <select
            value={selectedBrand?.id || ''}
            onChange={handleBrandChange}
            disabled={isLoadingBrands}
            className={cn(
              "w-full appearance-none rounded-lg border-2 border-gray-300 bg-white px-4 py-3 pr-10",
              "text-sm font-medium text-gray-900",
              "focus:border-black focus:outline-none focus:ring-0",
              "disabled:bg-gray-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          >
            <option value="">Select a brand...</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.brand_name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Product Dropdown */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Product</label>
        <div className="relative">
          <select
            value={selectedProduct?.id || ''}
            onChange={handleProductChange}
            disabled={!selectedBrand || isLoadingProducts}
            className={cn(
              "w-full appearance-none rounded-lg border-2 border-gray-300 bg-white px-4 py-3 pr-10",
              "text-sm font-medium text-gray-900",
              "focus:border-black focus:outline-none focus:ring-0",
              "disabled:bg-gray-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          >
            <option value="">
              {!selectedBrand
                ? 'Select a brand first...'
                : isLoadingProducts
                  ? 'Loading products...'
                  : 'Select a product...'}
            </option>
            {brandProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.product_name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Preview Card */}
      {selectedBrand && selectedProduct && (
        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-4 mt-4">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">Selected</div>
          <div className="flex items-center gap-4">
            {/* Brand Section */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 bg-white rounded-md flex items-center justify-center border border-gray-300 flex-shrink-0 overflow-hidden">
                {selectedBrand.brand_logo_url ? (
                  <Image
                    src={selectedBrand.brand_logo_url}
                    alt={selectedBrand.brand_name}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="text-xs text-gray-500">Brand</div>
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {selectedBrand.brand_name}
                </div>
              </div>
            </div>

            {/* Product Section */}
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 bg-white rounded-md flex items-center justify-center border border-gray-300 flex-shrink-0 overflow-hidden">
                {selectedProduct.user_product_photos?.[0]?.photo_url ? (
                  <Image
                    src={selectedProduct.user_product_photos[0].photo_url}
                    alt={selectedProduct.product_name}
                    width={48}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <Package className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500">Product</div>
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {selectedProduct.product_name}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
