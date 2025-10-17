'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Package, Tag, BarChart3 } from 'lucide-react';
import { UserBrand, UserProduct } from '@/lib/supabase';
import BrandSection from './BrandSection';
import ProductItem from './ProductItem';
import CreateBrandModal from './CreateBrandModal';
import EditBrandModal from './EditBrandModal';
import CreateProductModal from './CreateProductModal';
import SelectProductToBrandModal from './SelectProductToBrandModal';

interface AssetsData {
  brands: (UserBrand & { products?: UserProduct[] })[];
  unbrandedProducts: UserProduct[];
  stats: {
    totalBrands: number;
    totalProducts: number;
    unbrandedCount: number;
  };
}

export default function AssetsManager() {
  const [assetsData, setAssetsData] = useState<AssetsData>({
    brands: [],
    unbrandedProducts: [],
    stats: { totalBrands: 0, totalProducts: 0, unbrandedCount: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showCreateBrandModal, setShowCreateBrandModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [showSelectProductModal, setShowSelectProductModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<UserBrand | null>(null);
  const [selectedBrandIdForProduct, setSelectedBrandIdForProduct] = useState<string | null>(null);
  const [selectedBrandForProductSelection, setSelectedBrandForProductSelection] = useState<UserBrand | null>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const response = await fetch('/api/assets');
      if (response.ok) {
        const data = await response.json();
        setAssetsData(data);
      }
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Brand handlers
  const handleBrandCreated = (newBrand: UserBrand) => {
    setAssetsData(prev => ({
      ...prev,
      brands: [{ ...newBrand, products: [] }, ...prev.brands],
      stats: {
        ...prev.stats,
        totalBrands: prev.stats.totalBrands + 1
      }
    }));
  };

  const handleBrandUpdated = (updatedBrand: UserBrand) => {
    setAssetsData(prev => ({
      ...prev,
      brands: prev.brands.map(b =>
        b.id === updatedBrand.id ? { ...updatedBrand, products: b.products } : b
      )
    }));
  };

  const handleEditBrand = (brand: UserBrand) => {
    setEditingBrand(brand);
  };

  const handleDeleteBrand = async (brandId: string) => {
    try {
      const response = await fetch(`/api/user-brands/${brandId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh data to get updated product assignments
        await loadAssets();
      }
    } catch (error) {
      console.error('Error deleting brand:', error);
    }
  };

  // Product handlers
  const handleProductCreated = (newProduct: UserProduct) => {
    // If product has a brand_id, add it to that brand's products
    if (newProduct.brand_id) {
      setAssetsData(prev => ({
        ...prev,
        brands: prev.brands.map(b =>
          b.id === newProduct.brand_id
            ? { ...b, products: [newProduct, ...(b.products || [])] }
            : b
        ),
        stats: {
          ...prev.stats,
          totalProducts: prev.stats.totalProducts + 1
        }
      }));
    } else {
      // Add to unbranded products
      setAssetsData(prev => ({
        ...prev,
        unbrandedProducts: [newProduct, ...prev.unbrandedProducts],
        stats: {
          ...prev.stats,
          totalProducts: prev.stats.totalProducts + 1,
          unbrandedCount: prev.stats.unbrandedCount + 1
        }
      }));
    }
  };

  const handleEditProduct = async (productId: string, newName: string) => {
    try {
      // Find the product to get its current data
      let product: UserProduct | undefined;
      for (const brand of assetsData.brands) {
        product = brand.products?.find(p => p.id === productId);
        if (product) break;
      }
      if (!product) {
        product = assetsData.unbrandedProducts.find(p => p.id === productId);
      }
      if (!product) return;

      // Update local state immediately
      const updateProductInState = (p: UserProduct) =>
        p.id === productId ? { ...p, product_name: newName } : p;

      setAssetsData(prev => ({
        ...prev,
        brands: prev.brands.map(b => ({
          ...b,
          products: b.products?.map(updateProductInState)
        })),
        unbrandedProducts: prev.unbrandedProducts.map(updateProductInState)
      }));

      // Update on server
      const response = await fetch(`/api/user-products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: newName,
          description: product.description
        })
      });

      if (!response.ok) {
        // Revert on error
        await loadAssets();
        throw new Error('Failed to update product name');
      }
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/user-products/${productId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAssetsData(prev => ({
          ...prev,
          brands: prev.brands.map(b => ({
            ...b,
            products: b.products?.filter(p => p.id !== productId)
          })),
          unbrandedProducts: prev.unbrandedProducts.filter(p => p.id !== productId),
          stats: {
            ...prev.stats,
            totalProducts: prev.stats.totalProducts - 1,
            unbrandedCount: prev.unbrandedProducts.some(p => p.id === productId)
              ? prev.stats.unbrandedCount - 1
              : prev.stats.unbrandedCount
          }
        }));
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handlePhotoUpload = async (productId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('is_primary', 'false');

      const response = await fetch(`/api/user-products/${productId}/photos`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        await loadAssets();
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
    }
  };

  const handleDeletePhoto = async (productId: string, photoId: string) => {
    try {
      const response = await fetch(`/api/user-products/${productId}/photos?photoId=${photoId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadAssets();
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  const handleAddProductToBrand = (brandId: string, mode: 'create' | 'select') => {
    const brand = assetsData.brands.find(b => b.id === brandId);
    if (!brand) return;

    if (mode === 'create') {
      setSelectedBrandIdForProduct(brandId);
      setShowCreateProductModal(true);
    } else {
      setSelectedBrandForProductSelection(brand);
      setShowSelectProductModal(true);
    }
  };

  const handleProductsSelectedForBrand = async (productIds: string[]) => {
    if (!selectedBrandForProductSelection) return;

    try {
      // Update each product's brand_id
      await Promise.all(
        productIds.map(productId =>
          fetch(`/api/user-products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand_id: selectedBrandForProductSelection.id })
          })
        )
      );

      // Refresh data
      await loadAssets();
    } catch (error) {
      console.error('Error assigning products to brand:', error);
    }
  };

  const handleMoveProductFromBrand = async (productId: string) => {
    // TODO: Implement product movement modal
    // For now, just set brand_id to null
    if (confirm('Move this product to unbranded section?')) {
      try {
        const response = await fetch(`/api/user-products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand_id: null })
        });

        if (response.ok) {
          await loadAssets();
        }
      } catch (error) {
        console.error('Error moving product:', error);
      }
    }
  };

  // Search filtering
  const filteredBrands = assetsData.brands.filter(brand => {
    const brandMatch = brand.brand_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (brand.brand_slogan?.toLowerCase() || '').includes(searchTerm.toLowerCase());

    const productsMatch = brand.products?.some(product =>
      product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return brandMatch || productsMatch;
  });

  const filteredUnbrandedProducts = assetsData.unbrandedProducts.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Assets Management</h2>
            <p className="text-gray-600">Manage your brands and products in one place</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateBrandModal(true)}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Tag className="w-4 h-4" />
              New Brand
            </button>
            <button
              onClick={() => {
                setSelectedBrandIdForProduct(null);
                setShowCreateProductModal(true);
              }}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Product
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Tag className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{assetsData.stats.totalBrands}</p>
                <p className="text-sm text-gray-600">Brands</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{assetsData.stats.totalProducts}</p>
                <p className="text-sm text-gray-600">Total Products</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-gray-900">{assetsData.stats.unbrandedCount}</p>
                <p className="text-sm text-gray-600">Unbranded</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-6">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search brands and products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>

      {/* Brands List */}
      <div className="space-y-4">
        {filteredBrands.length === 0 && filteredUnbrandedProducts.length === 0 && searchTerm ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">Try adjusting your search terms</p>
          </div>
        ) : (
          <>
            {/* Brands with Products */}
            {filteredBrands.map((brand) => (
              <BrandSection
                key={brand.id}
                brand={brand}
                onEditBrand={handleEditBrand}
                onDeleteBrand={handleDeleteBrand}
                onEditProduct={handleEditProduct}
                onDeleteProduct={handleDeleteProduct}
                onPhotoUpload={handlePhotoUpload}
                onDeletePhoto={handleDeletePhoto}
                onAddProductToBrand={handleAddProductToBrand}
                onMoveProductFromBrand={handleMoveProductFromBrand}
                defaultExpanded={!!searchTerm}
              />
            ))}

            {/* Unbranded Products Section */}
            {filteredUnbrandedProducts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Package className="w-5 h-5 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Unbranded Products ({filteredUnbrandedProducts.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {filteredUnbrandedProducts.map((product) => (
                    <ProductItem
                      key={product.id}
                      product={product}
                      onEdit={handleEditProduct}
                      onDelete={handleDeleteProduct}
                      onPhotoUpload={handlePhotoUpload}
                      onDeletePhoto={handleDeletePhoto}
                      indented={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {assetsData.brands.length === 0 && assetsData.unbrandedProducts.length === 0 && !searchTerm && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <Tag className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">No assets yet</h3>
                <p className="text-gray-600 mb-6">Start by creating your first brand or product</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowCreateBrandModal(true)}
                    className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <Tag className="w-4 h-4" />
                    Create Brand
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBrandIdForProduct(null);
                      setShowCreateProductModal(true);
                    }}
                    className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    Create Product
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <CreateBrandModal
        isOpen={showCreateBrandModal}
        onClose={() => setShowCreateBrandModal(false)}
        onBrandCreated={handleBrandCreated}
      />

      <EditBrandModal
        isOpen={!!editingBrand}
        brand={editingBrand}
        onClose={() => setEditingBrand(null)}
        onBrandUpdated={handleBrandUpdated}
      />

      <CreateProductModal
        isOpen={showCreateProductModal}
        onClose={() => {
          setShowCreateProductModal(false);
          setSelectedBrandIdForProduct(null);
        }}
        onProductCreated={handleProductCreated}
        preselectedBrandId={selectedBrandIdForProduct}
      />

      <SelectProductToBrandModal
        isOpen={showSelectProductModal}
        onClose={() => {
          setShowSelectProductModal(false);
          setSelectedBrandForProductSelection(null);
        }}
        brandName={selectedBrandForProductSelection?.brand_name || ''}
        availableProducts={assetsData.unbrandedProducts}
        onProductsSelected={handleProductsSelectedForBrand}
      />
    </div>
  );
}
