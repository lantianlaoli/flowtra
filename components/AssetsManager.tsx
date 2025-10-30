'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Package, Tag, BarChart3 } from 'lucide-react';
import { UserBrand, UserProduct } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
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
  const { showSuccess, showError } = useToast();
  const [assetsData, setAssetsData] = useState<AssetsData>({
    brands: [],
    unbrandedProducts: [],
    stats: { totalBrands: 0, totalProducts: 0, unbrandedCount: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

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
    if (deletingProductId) {
      return; // Prevent multiple simultaneous deletes
    }

    try {
      setDeletingProductId(productId);

      const response = await fetch(`/api/user-products/${productId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state
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

        // Show success message with affected projects count
        const affectedCount = data.affectedProjects || 0;
        if (affectedCount > 0) {
          showSuccess(
            `Product deleted. ${affectedCount} project(s) have been automatically unlinked.`,
            5000
          );
        } else {
          showSuccess('Product deleted successfully', 3000);
        }
      } else {
        // Handle error response
        const errorMessage = data.message || data.error || 'Failed to delete product';
        console.error('Error deleting product:', data);
        showError(errorMessage, 5000);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      showError(
        'An error occurred while deleting the product. Please try again.',
        5000
      );
    } finally {
      setDeletingProductId(null);
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
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-1">Assets Management</h2>
            <p className="text-sm md:text-base text-gray-600">Manage your brands and products in one place</p>
          </div>
          <div className="flex gap-2 md:gap-3">
            <button
              onClick={() => setShowCreateBrandModal(true)}
              className="flex items-center gap-1.5 md:gap-2 bg-gray-900 text-white px-3 md:px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm md:text-base"
            >
              <Tag className="w-4 h-4" />
              <span className="hidden sm:inline">New Brand</span>
              <span className="sm:hidden">Brand</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-gray-50 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Tag className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">{assetsData.stats.totalBrands}</p>
                <p className="text-xs md:text-sm text-gray-600">Brands</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Package className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">{assetsData.stats.totalProducts}</p>
                <p className="text-xs md:text-sm text-gray-600">Total Products</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xl md:text-2xl font-semibold text-gray-900">{assetsData.stats.unbrandedCount}</p>
                <p className="text-xs md:text-sm text-gray-600">Unbranded</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4 md:mt-6">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search brands and products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm md:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
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
                deletingProductId={deletingProductId}
              />
            ))}

            {/* Unbranded Products Section */}
            {filteredUnbrandedProducts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6">
                <div className="flex items-center gap-2 md:gap-3 mb-4">
                  <Package className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
                  <h3 className="text-base md:text-lg font-semibold text-gray-900">
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
                      isDeleting={deletingProductId === product.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {assetsData.brands.length === 0 && assetsData.unbrandedProducts.length === 0 && !searchTerm && (
              <div className="bg-white rounded-xl border border-gray-200 p-8 md:p-12 text-center">
                <Tag className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 text-gray-300" />
                <h3 className="text-lg md:text-xl font-medium text-gray-900 mb-2">No brands yet</h3>
                <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6">Start by creating your first brand. All products must belong to a brand.</p>
                <button
                  onClick={() => setShowCreateBrandModal(true)}
                  className="flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm md:text-base mx-auto"
                >
                  <Tag className="w-4 h-4" />
                  Create Brand
                </button>
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
