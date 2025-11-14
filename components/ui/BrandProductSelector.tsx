'use client';

import { useState, useEffect, useRef } from 'react';
import { Package, Building2, ChevronDown, Check } from 'lucide-react';
import { UserProduct, UserBrand } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface BrandProductSelectorProps {
  selectedBrand: UserBrand | null;
  selectedProduct: UserProduct | null;
  onBrandSelect: (brand: UserBrand | null) => void;
  onProductSelect: (product: UserProduct | null) => void;
  className?: string;
  variant?: 'default' | 'compact';
}

export default function BrandProductSelector({
  selectedBrand,
  selectedProduct,
  onBrandSelect,
  onProductSelect,
  className,
  variant = 'default'
}: BrandProductSelectorProps) {
  const [brands, setBrands] = useState<UserBrand[]>([]);
  const [allProducts, setAllProducts] = useState<Map<string, UserProduct[]>>(new Map());
  const [brandProducts, setBrandProducts] = useState<UserProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  const brandDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Load all brands and their products on mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Update displayed products when brand changes (instant, from cache)
  useEffect(() => {
    if (selectedBrand) {
      const products = allProducts.get(selectedBrand.id) || [];
      setBrandProducts(products);
    } else {
      setBrandProducts([]);
      onProductSelect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand?.id, allProducts]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target as Node)) {
        setIsBrandDropdownOpen(false);
      }
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      // Step 1: Load all brands
      const brandsResponse = await fetch('/api/brands');
      const brandsData = await brandsResponse.json();

      if (!brandsData.success || !Array.isArray(brandsData.brands)) {
        console.error('Failed to load brands');
        return;
      }

      const loadedBrands = brandsData.brands;
      setBrands(loadedBrands);

      // Step 2: Load products for all brands in parallel
      const productsPromises = loadedBrands.map(async (brand: UserBrand) => {
        try {
          const response = await fetch(`/api/brands/${brand.id}/products`);
          const data = await response.json();

          if (data.success && Array.isArray(data.products)) {
            return { brandId: brand.id, products: data.products };
          }
          return { brandId: brand.id, products: [] };
        } catch (error) {
          console.error(`Error loading products for brand ${brand.id}:`, error);
          return { brandId: brand.id, products: [] };
        }
      });

      const productsResults = await Promise.all(productsPromises);

      // Step 3: Build products map
      const productsMap = new Map<string, UserProduct[]>();
      productsResults.forEach(({ brandId, products }) => {
        productsMap.set(brandId, products);
      });

      setAllProducts(productsMap);
    } catch (error) {
      console.error('Error loading brands and products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrandSelect = (brand: UserBrand) => {
    onBrandSelect(brand);
    onProductSelect(null); // Reset product when changing brand
    setIsBrandDropdownOpen(false);
  };

  const handleProductSelect = (product: UserProduct) => {
    // Attach brand to product
    const productWithBrand = { ...product, brand: selectedBrand };
    onProductSelect(productWithBrand as UserProduct);
    setIsProductDropdownOpen(false);
  };

  const getProductImage = (product?: UserProduct | null) => {
    if (!product?.user_product_photos?.length) return null;
    const primary = product.user_product_photos.find(photo => photo.is_primary);
    return (primary || product.user_product_photos[0])?.photo_url ?? null;
  };

  const isCompact = variant === 'compact';

  if (isCompact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Brand selector */}
        <div className="relative" ref={brandDropdownRef}>
          <button
            type="button"
            onClick={() => !isLoading && setIsBrandDropdownOpen(!isBrandDropdownOpen)}
            disabled={isLoading}
            className={cn(
              "w-11 h-11 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm transition-colors cursor-pointer",
              "hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent",
              isLoading && "opacity-50 cursor-not-allowed",
              selectedBrand && "border-gray-900"
            )}
            title={selectedBrand ? selectedBrand.brand_name : 'Select brand'}
          >
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-gray-100">
              {selectedBrand?.brand_logo_url ? (
                <Image
                  src={selectedBrand.brand_logo_url}
                  alt={selectedBrand.brand_name}
                  width={36}
                  height={36}
                  className="object-cover w-full h-full"
                />
              ) : (
                <Building2 className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </button>

            {isBrandDropdownOpen && !isLoading && brands.length > 0 && (
              <div className="absolute z-50 w-72 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto bottom-full mb-2">
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => handleBrandSelect(brand)}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0 cursor-pointer",
                      selectedBrand?.id === brand.id && "bg-gray-50"
                    )}
                  >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                    {brand.brand_logo_url ? (
                      <Image
                        src={brand.brand_logo_url}
                        alt={brand.brand_name}
                        width={40}
                        height={40}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{brand.brand_name}</div>
                    <div className="text-xs text-gray-500 truncate">{brand.brand_slogan || (brand as any).brand_details || 'No slogan'}</div>
                  </div>
                  {selectedBrand?.id === brand.id && (
                    <Check className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product selector */}
        <div className="relative" ref={productDropdownRef}>
          <button
            type="button"
            onClick={() => selectedBrand && setIsProductDropdownOpen(!isProductDropdownOpen)}
            disabled={!selectedBrand || brandProducts.length === 0}
            className={cn(
              "w-11 h-11 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm transition-colors cursor-pointer",
              "hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent",
              (!selectedBrand || brandProducts.length === 0) && "opacity-50 cursor-not-allowed",
              selectedProduct && "border-gray-900"
            )}
            title={
              selectedProduct
                ? selectedProduct.product_name
                : selectedBrand
                  ? 'Select product'
                  : 'Select a brand first'
            }
          >
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-gray-100">
              {selectedProduct ? (
                (() => {
                  const photoUrl = getProductImage(selectedProduct);
                  return photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt={selectedProduct.product_name}
                      width={36}
                      height={36}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <Package className="w-4 h-4 text-gray-500" />
                  );
                })()
              ) : (
                <Package className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </button>

            {isProductDropdownOpen && selectedBrand && brandProducts.length > 0 && (
              <div className="absolute z-50 w-80 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto bottom-full mb-2">
                {brandProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductSelect(product)}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0 cursor-pointer",
                      selectedProduct?.id === product.id && "bg-gray-50"
                    )}
                  >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                    {(() => {
                      const photoUrl = getProductImage(product);
                      return photoUrl ? (
                        <Image
                          src={photoUrl}
                          alt={product.product_name}
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <Package className="w-4 h-4 text-gray-500" />
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{product.product_name}</div>
                    <div className="text-xs text-gray-500 truncate">{product.description || 'No description'}</div>
                  </div>
                  {selectedProduct?.id === product.id && (
                    <Check className="w-4 h-4 text-gray-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-base font-medium text-gray-900">
        Brand & Product
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Brand Selection */}
        <div className="space-y-2" ref={brandDropdownRef}>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Building2 className="w-4 h-4" />
            Select Brand
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsBrandDropdownOpen(!isBrandDropdownOpen)}
              disabled={isLoading}
              className={cn(
                "w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg",
                "focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent",
                "bg-white text-sm text-left cursor-pointer",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-3"
              )}
            >
              {selectedBrand ? (
                <>
                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {selectedBrand.brand_logo_url ? (
                      <Image
                        src={selectedBrand.brand_logo_url}
                        alt={selectedBrand.brand_name}
                        width={32}
                        height={32}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{selectedBrand.brand_name}</div>
                    <div className="text-xs text-gray-500 truncate">{selectedBrand.brand_slogan || (selectedBrand as any).brand_details || 'No slogan'}</div>
                  </div>
                </>
              ) : (
                <span className="text-gray-500">
                  {isLoading ? 'Loading...' : brands.length === 0 ? 'No brands found' : 'Choose a brand'}
                </span>
              )}
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </button>

            {/* Dropdown Menu */}
            {isBrandDropdownOpen && !isLoading && brands.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => handleBrandSelect(brand)}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3",
                      "border-b border-gray-100 last:border-b-0",
                      selectedBrand?.id === brand.id && "bg-gray-50"
                    )}
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{brand.brand_name}</div>
                      <div className="text-xs text-gray-500 truncate">{brand.brand_slogan || 'No slogan'}</div>
                    </div>
                    {selectedBrand?.id === brand.id && (
                      <Check className="w-5 h-5 text-black flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Product Selection */}
        <div className="space-y-2" ref={productDropdownRef}>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Package className="w-4 h-4" />
            Select Product
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
              disabled={!selectedBrand || isLoading}
              className={cn(
                "w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg",
                "focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent",
                "bg-white text-sm text-left cursor-pointer",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-3"
              )}
            >
              {selectedProduct ? (
                <>
                  <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {selectedProduct.user_product_photos?.find(p => p.is_primary)?.photo_url || selectedProduct.user_product_photos?.[0]?.photo_url ? (
                      <Image
                        src={selectedProduct.user_product_photos.find(p => p.is_primary)?.photo_url || selectedProduct.user_product_photos[0]?.photo_url || ''}
                        alt={selectedProduct.product_name}
                        width={32}
                        height={32}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <Package className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{selectedProduct.product_name}</div>
                    {(selectedProduct.product_details || selectedProduct.description) && (
                      <div className="text-xs text-gray-500 truncate">{selectedProduct.product_details || selectedProduct.description}</div>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-gray-500">
                  {!selectedBrand
                    ? 'Select a brand first'
                    : isLoading
                    ? 'Loading...'
                    : brandProducts.length === 0
                    ? 'No products in this brand'
                    : 'Choose a product'}
                </span>
              )}
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </button>

            {/* Dropdown Menu */}
            {isProductDropdownOpen && !isLoading && brandProducts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {brandProducts.map((product) => {
                  const primaryPhoto = product.user_product_photos?.find(p => p.is_primary);
                  const photo = primaryPhoto || product.user_product_photos?.[0];

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleProductSelect(product)}
                      className={cn(
                        "w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3",
                        "border-b border-gray-100 last:border-b-0",
                        selectedProduct?.id === product.id && "bg-gray-50"
                      )}
                    >
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{product.product_name}</div>
                        {(product.product_details || product.description) && (
                          <div className="text-xs text-gray-500 truncate">{product.product_details || product.description}</div>
                        )}
                      </div>
                      {selectedProduct?.id === product.id && (
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
