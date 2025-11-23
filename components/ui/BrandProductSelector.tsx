'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  replicaMode?: boolean;
  replicaSelectedProductIds?: string[];
  onReplicaSelectionChange?: (products: UserProduct[]) => void;
  replicaSelectionLimit?: number;
  onReplicaSelectionLimitReached?: (limit: number) => void;
}

export default function BrandProductSelector({
  selectedBrand,
  selectedProduct,
  onBrandSelect,
  onProductSelect,
  className,
  variant = 'default',
  replicaMode = false,
  replicaSelectedProductIds = [],
  onReplicaSelectionChange,
  replicaSelectionLimit = 9,
  onReplicaSelectionLimitReached,
}: BrandProductSelectorProps) {
  const [brands, setBrands] = useState<UserBrand[]>([]);
  const [allProducts, setAllProducts] = useState<Map<string, UserProduct[]>>(new Map());
  const [brandProducts, setBrandProducts] = useState<UserProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false); // NEW: Independent products loading state
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  const brandDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const replicaSelectedIds = replicaSelectedProductIds;

  const idToProductMap = useMemo(() => {
    const map = new Map<string, UserProduct>();
    brandProducts.forEach(product => {
      map.set(product.id, product);
    });
    return map;
  }, [brandProducts]);

  const resolveProductsFromIds = useCallback((ids: string[]) => {
    return ids
      .map(id => idToProductMap.get(id))
      .filter((product): product is UserProduct => Boolean(product));
  }, [idToProductMap]);

  const replicaSelectedProducts = useMemo(
    () => resolveProductsFromIds(replicaSelectedIds),
    [resolveProductsFromIds, replicaSelectedIds]
  );

  const primaryReplicaProduct = replicaSelectedProducts[0] ?? null;
  const replicaSelectedCount = replicaSelectedIds.length;

  // Load all brands and their products on mount
  useEffect(() => {
    console.log('[BrandProductSelector] Component mounted, calling loadAllData');
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update displayed products when brand changes (instant, from cache)
  useEffect(() => {
    if (selectedBrand) {
      const products = allProducts.get(selectedBrand.id) || [];
      console.log('[BrandProductSelector] Brand selected:', selectedBrand.brand_name, '| Products found:', products.length);
      setBrandProducts(products);
    } else {
      console.log('[BrandProductSelector] No brand selected');
      setBrandProducts([]);
      onProductSelect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand, allProducts]);

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
    console.log('[BrandProductSelector] Loading brands...');
    setIsLoading(true);
    try {
      // ✅ OPTIMIZATION: Only load brands immediately (fast ~200ms)
      // Products will be loaded on-demand when a brand is selected
      const brandsResponse = await fetch('/api/brands');
      const brandsData = await brandsResponse.json();

      if (!brandsData.success || !Array.isArray(brandsData.brands)) {
        console.error('[BrandProductSelector] Failed to load brands');
        return;
      }

      const loadedBrands = brandsData.brands;
      console.log('[BrandProductSelector] Loaded brands:', loadedBrands.length);
      setBrands(loadedBrands);

      // ✅ Enable brand selector immediately - no need to wait for products!
    } catch (error) {
      console.error('[BrandProductSelector] Error loading brands:', error);
    } finally {
      setIsLoading(false); // Brand selector now available!
    }
  };

  // ✅ NEW: Load products for a specific brand on-demand
  const loadProductsForBrand = async (brand: UserBrand) => {
    // Check if products are already cached
    if (allProducts.has(brand.id)) {
      console.log(`[BrandProductSelector] Products for "${brand.brand_name}" already cached`);
      return;
    }

    console.log(`[BrandProductSelector] Loading products for brand "${brand.brand_name}"...`);
    setIsLoadingProducts(true);

    try {
      const response = await fetch(`/api/brands/${brand.id}/products`);
      const data = await response.json();

      if (data.success && Array.isArray(data.products)) {
        console.log(`[BrandProductSelector] Loaded ${data.products.length} products for "${brand.brand_name}"`);

        // Update products map with new brand's products
        setAllProducts(prev => {
          const newMap = new Map(prev);
          newMap.set(brand.id, data.products);
          return newMap;
        });
      } else {
        console.warn(`[BrandProductSelector] No products found for "${brand.brand_name}"`);
        setAllProducts(prev => {
          const newMap = new Map(prev);
          newMap.set(brand.id, []);
          return newMap;
        });
      }
    } catch (error) {
      console.error(`[BrandProductSelector] Error loading products for brand ${brand.id}:`, error);
      // Cache empty array to avoid repeated failed requests
      setAllProducts(prev => {
        const newMap = new Map(prev);
        newMap.set(brand.id, []);
        return newMap;
      });
    } finally {
      setIsLoadingProducts(false);
    }
  };

  const handleBrandSelect = (brand: UserBrand) => {
    console.log('[BrandProductSelector] Brand selected:', brand.brand_name, 'ID:', brand.id);
    onBrandSelect(brand);
    onProductSelect(null); // Reset product when changing brand
    setIsBrandDropdownOpen(false);

    // ✅ NEW: Load products for this brand on-demand
    loadProductsForBrand(brand);
  };

  const handleProductSelect = (product: UserProduct) => {
    console.log('[BrandProductSelector] Product selected:', product.product_name, 'ID:', product.id);
    // Attach brand to product
    const productWithBrand = { ...product, brand: selectedBrand };
    onProductSelect(productWithBrand as UserProduct);
    setIsProductDropdownOpen(false);
  };

  const handleReplicaProductToggle = (product: UserProduct) => {
    if (!replicaMode || !onReplicaSelectionChange) {
      handleProductSelect(product);
      return;
    }

    const isSelected = replicaSelectedIds.includes(product.id);
    if (isSelected) {
      const nextIds = replicaSelectedIds.filter(id => id !== product.id);
      onReplicaSelectionChange(resolveProductsFromIds(nextIds));
      return;
    }

    if (replicaSelectedIds.length >= replicaSelectionLimit) {
      onReplicaSelectionLimitReached?.(replicaSelectionLimit);
      return;
    }

    const nextIds = [...replicaSelectedIds, product.id];
    onReplicaSelectionChange(resolveProductsFromIds(nextIds));
  };

  const getProductImage = (product?: UserProduct | null) => {
    if (!product?.user_product_photos?.length) return null;
    const primary = product.user_product_photos.find(photo => photo.is_primary);
    return (primary || product.user_product_photos[0])?.photo_url ?? null;
  };

  const isCompact = variant === 'compact';
  if (isCompact) {
    const productButtonTitle = replicaMode
      ? replicaSelectedCount > 0
        ? `${replicaSelectedCount} product${replicaSelectedCount > 1 ? 's' : ''} selected`
        : `Select products (up to ${replicaSelectionLimit})`
      : selectedProduct
        ? selectedProduct.product_name
        : selectedBrand
          ? 'Select product'
          : 'Select a brand first';

    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Brand selector */}
        <div className="relative" ref={brandDropdownRef}>
          <button
            type="button"
            onClick={() => {
              console.log('[BrandProductSelector] Brand button clicked');
              if (!isLoading) {
                setIsBrandDropdownOpen(!isBrandDropdownOpen);
              }
            }}
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
            <div className="absolute left-0 bottom-full mb-2 z-[100] w-72 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
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
                    <div className="text-xs text-gray-500 truncate">{brand.brand_slogan || brand.brand_details || 'No slogan'}</div>
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
            onClick={() => {
              if (selectedBrand) {
                setIsProductDropdownOpen(!isProductDropdownOpen);
              }
            }}
            disabled={!selectedBrand || brandProducts.length === 0}
            className={cn(
              "w-11 h-11 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm transition-colors cursor-pointer",
              "hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent",
              (!selectedBrand || brandProducts.length === 0) && "opacity-50 cursor-not-allowed",
              (!replicaMode && selectedProduct) && "border-gray-900",
              (replicaMode && replicaSelectedCount > 0) && "border-gray-900"
            )}
            title={productButtonTitle}
          >
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-gray-100">
              {replicaMode ? (
                primaryReplicaProduct ? (
                  (() => {
                    const photoUrl = getProductImage(primaryReplicaProduct);
                    return photoUrl ? (
                      <Image
                        src={photoUrl}
                        alt={primaryReplicaProduct.product_name}
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
                )
              ) : selectedProduct ? (
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
            <div className="absolute left-0 bottom-full mb-2 z-[100] w-80 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
              {brandProducts.map((product) => {
                const isReplicaSelected = replicaMode && replicaSelectedIds.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => (replicaMode ? handleReplicaProductToggle(product) : handleProductSelect(product))}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0 cursor-pointer",
                      !replicaMode && selectedProduct?.id === product.id && "bg-gray-50",
                      replicaMode && isReplicaSelected && "bg-purple-50"
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
                    {replicaMode ? (
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border flex items-center justify-center",
                          isReplicaSelected ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 text-transparent"
                        )}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                    ) : (
                      selectedProduct?.id === product.id && (
                        <Check className="w-4 h-4 text-gray-600" />
                      )
                    )}
                  </button>
                );
              })}
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
                    <div className="text-xs text-gray-500 truncate">{selectedBrand.brand_slogan || selectedBrand.brand_details || 'No slogan'}</div>
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
            {replicaMode ? 'Select Products (up to ' + replicaSelectionLimit + ')' : 'Select Product'}
          </label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
              disabled={!selectedBrand || isLoadingProducts}
              className={cn(
                "w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg",
                "focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent",
                "bg-white text-sm text-left cursor-pointer",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-3"
              )}
            >
              {replicaMode ? (
                replicaSelectedCount > 0 && primaryReplicaProduct ? (
                  <>
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {(() => {
                        const photoUrl = getProductImage(primaryReplicaProduct);
                        return photoUrl ? (
                          <Image
                            src={photoUrl}
                            alt={primaryReplicaProduct.product_name}
                            width={32}
                            height={32}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-gray-400" />
                        );
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">{primaryReplicaProduct.product_name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {replicaSelectedCount > 1
                          ? `+${replicaSelectedCount - 1} more · ${replicaSelectedCount}/${replicaSelectionLimit} selected`
                          : `1/${replicaSelectionLimit} selected`}
                      </div>
                    </div>
                  </>
                ) : (
                  <span className="text-gray-500">
                    {!selectedBrand
                      ? 'Select a brand first'
                      : brandProducts.length === 0
                      ? 'No products in this brand'
                      : `Choose up to ${replicaSelectionLimit} products`}
                  </span>
                )
              ) : selectedProduct ? (
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
                    : isLoadingProducts
                    ? 'Loading products...'
                    : brandProducts.length === 0
                    ? 'No products in this brand'
                    : 'Choose a product'}
                </span>
              )}
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </button>

            {/* Dropdown Menu */}
            {isProductDropdownOpen && !isLoadingProducts && brandProducts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {brandProducts.map((product) => {
                  const primaryPhoto = product.user_product_photos?.find(p => p.is_primary);
                  const photo = primaryPhoto || product.user_product_photos?.[0];
                  const isReplicaSelected = replicaMode && replicaSelectedIds.includes(product.id);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => (replicaMode ? handleReplicaProductToggle(product) : handleProductSelect(product))}
                      className={cn(
                        "w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3",
                        "border-b border-gray-100 last:border-b-0",
                        !replicaMode && selectedProduct?.id === product.id && "bg-gray-50",
                        replicaMode && isReplicaSelected && "bg-purple-50"
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
                      {replicaMode ? (
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center",
                            isReplicaSelected ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 text-transparent"
                          )}
                        >
                          <Check className="w-3 h-3" />
                        </div>
                      ) : (
                        selectedProduct?.id === product.id && (
                          <Check className="w-5 h-5 text-black flex-shrink-0" />
                        )
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {replicaMode && (
            <p className="text-xs text-purple-700">{replicaSelectedCount}/{replicaSelectionLimit} selected</p>
          )}
        </div>
      </div>
    </div>
  );
}
