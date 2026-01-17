'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, Package, Tag, BarChart3, ExternalLink, UserCircle } from 'lucide-react';
import { UserBrand, UserProduct, UserAvatar } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import BrandSection from './BrandSection';
import ProductCard from './ProductCard';
import CreateBrandModal from './CreateBrandModal';
import EditBrandModal from './EditBrandModal';
import EditProductModal from './EditProductModal';
import CreateProductModal from './CreateProductModal';
import SelectProductToBrandModal from './SelectProductToBrandModal';
import CreateAvatarModal from './CreateAvatarModal';
import EditAvatarModal from './EditAvatarModal';
import AvatarCard from './AvatarCard';

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
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [deletingAvatarId, setDeletingAvatarId] = useState<string | null>(null);

  // Avatar state
  const [avatars, setAvatars] = useState<UserAvatar[]>([]);
  const [activeTab, setActiveTab] = useState<'brands' | 'avatars'>('brands');

  // Modal states
  const [showCreateBrandModal, setShowCreateBrandModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [showSelectProductModal, setShowSelectProductModal] = useState(false);
  const [showCreateAvatarModal, setShowCreateAvatarModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<UserBrand | null>(null);
  const [editingProduct, setEditingProduct] = useState<UserProduct | null>(null);
  const [editingAvatar, setEditingAvatar] = useState<UserAvatar | null>(null);
  const [selectedBrandIdForProduct, setSelectedBrandIdForProduct] = useState<string | null>(null);
  const [selectedBrandForProductSelection, setSelectedBrandForProductSelection] = useState<UserBrand | null>(null);

  useEffect(() => {
    loadAssets();
    loadAvatars();
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

  const loadAvatars = async () => {
    try {
      const response = await fetch('/api/user-avatars');
      if (response.ok) {
        const data = await response.json();
        setAvatars(data.avatars || []);
      }
    } catch (error) {
      console.error('Error loading avatars:', error);
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
    if (deletingBrandId) {
      return; // Prevent multiple simultaneous deletes
    }

    try {
      setDeletingBrandId(brandId);
      const response = await fetch(`/api/user-brands/${brandId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        await loadAssets();
        showSuccess(data.message || 'Brand deleted successfully', 4000);
        return;
      }

      const errorMessage = data.message || data.error || 'Failed to delete brand';
      console.error('Error deleting brand:', data);
      showError(errorMessage, 5000);
    } catch (error) {
      console.error('Error deleting brand:', error);
      showError('An error occurred while deleting the brand. Please try again.', 5000);
    } finally {
      setDeletingBrandId(null);
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

    // Refresh from the server to ensure photos show up immediately
    void loadAssets();
  };

  const handleEditProduct = (product: UserProduct) => {
    setEditingProduct(product);
  };

  const handleProductUpdated = (updatedProduct: UserProduct) => {
    setAssetsData(prev => ({
      ...prev,
      brands: prev.brands.map(b => ({
        ...b,
        products: b.products?.map(p => p.id === updatedProduct.id ? updatedProduct : p)
      })),
      unbrandedProducts: prev.unbrandedProducts.map(p =>
        p.id === updatedProduct.id ? updatedProduct : p
      )
    }));
    showSuccess('Product updated successfully');
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

  // Avatar handlers
  const handleAvatarCreated = (newAvatar: UserAvatar) => {
    setAvatars(prev => [newAvatar, ...prev]);
    showSuccess('Avatar created successfully');
  };

  const handleAvatarUpdated = (updatedAvatar: UserAvatar) => {
    setAvatars(prev => prev.map(a => a.id === updatedAvatar.id ? updatedAvatar : a));
    showSuccess('Avatar updated successfully');
  };

  const handleEditAvatar = (avatar: UserAvatar) => {
    setEditingAvatar(avatar);
  };

  const handleDeleteAvatar = async (avatarId: string) => {
    if (deletingAvatarId) {
      return; // Prevent multiple simultaneous deletes
    }

    try {
      setDeletingAvatarId(avatarId);

      const response = await fetch(`/api/user-avatars?avatarId=${avatarId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAvatars(prev => prev.filter(a => a.id !== avatarId));
        showSuccess('Avatar deleted successfully');
      } else {
        const data = await response.json();
        const errorMessage = data.message || data.error || 'Failed to delete avatar';
        console.error('Error deleting avatar:', data);
        showError(errorMessage);
      }
    } catch (error) {
      console.error('Error deleting avatar:', error);
      showError('An error occurred while deleting the avatar. Please try again.');
    } finally {
      setDeletingAvatarId(null);
    }
  };

  // Search filtering
  const filteredBrands = assetsData.brands.filter(brand => {
    const brandMatch = brand.brand_name.toLowerCase().includes(searchTerm.toLowerCase());

    const productsMatch = brand.products?.some(product =>
      product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return brandMatch || productsMatch;
  });

  const filteredUnbrandedProducts = assetsData.unbrandedProducts.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAvatars = avatars.filter(avatar =>
    avatar.avatar_name.toLowerCase().includes(searchTerm.toLowerCase())
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
      {/* Tab Switcher */}
      <div className="border-b border-gray-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('brands')}
            className={`
              flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'brands'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <Package className="w-4 h-4" />
            <span>Brands & Products</span>
          </button>
          <button
            onClick={() => setActiveTab('avatars')}
            className={`
              flex items-center gap-2 py-4 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'avatars'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'}
            `}
          >
            <UserCircle className="w-4 h-4" />
            <span>Avatars</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'brands' ? (
          <>
            {/* Actions & Search */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search brands and products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                />
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <a
                  href="https://www.flowtra.store/blog/free-ugc-download-methods-2025"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Download Viral Videos</span>
                  <span className="sm:hidden">Videos</span>
                </a>
                <button
                  onClick={() => setShowCreateBrandModal(true)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  <Tag className="w-4 h-4" />
                  New Brand
                </button>
              </div>
            </div>

            {/* Brands & Products Tab */}
            {filteredBrands.length === 0 && filteredUnbrandedProducts.length === 0 && searchTerm ? (
              <div className="py-12 text-center">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-500">Try adjusting your search terms</p>
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
                    onViewProduct={() => {}}
                    onEditProduct={handleEditProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onAddProductToBrand={handleAddProductToBrand}
                    defaultExpanded={!!searchTerm}
                    deletingProductId={deletingProductId}
                  />
                ))}

                {/* Unbranded Products Section */}
                {filteredUnbrandedProducts.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Package className="w-4 h-4 text-gray-400" />
                      <h3 className="text-base font-semibold text-gray-900">
                        Unbranded Products
                      </h3>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {filteredUnbrandedProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onEditClick={handleEditProduct}
                          onDelete={handleDeleteProduct}
                          isDeleting={deletingProductId === product.id}
                          mode="compact"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {assetsData.brands.length === 0 && assetsData.unbrandedProducts.length === 0 && !searchTerm && (
                  <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-xl">
                    <Tag className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No brands yet</h3>
                    <p className="text-gray-500 mb-6">Start by creating your first brand.</p>
                    <button
                      onClick={() => setShowCreateBrandModal(true)}
                      className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                      <Tag className="w-4 h-4" />
                      Create Brand
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Actions & Search */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search avatars..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                />
              </div>
              <div className="w-full md:w-auto">
                <button
                  onClick={() => setShowCreateAvatarModal(true)}
                  className="w-full md:w-auto flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium whitespace-nowrap"
                >
                  <UserCircle className="w-4 h-4" />
                  Add Avatar
                </button>
              </div>
            </div>

            {/* Avatars Tab */}
            {filteredAvatars.length === 0 && searchTerm ? (
              <div className="py-12 text-center">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-500">Try adjusting your search terms</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserCircle className="w-4 h-4 text-gray-400" />
                  <h3 className="text-base font-semibold text-gray-900">
                    Avatars
                  </h3>
                </div>
                {filteredAvatars.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredAvatars.map((avatar) => (
                      <AvatarCard
                        key={avatar.id}
                        avatar={avatar}
                        onEdit={handleEditAvatar}
                        onDelete={handleDeleteAvatar}
                        isDeleting={deletingAvatarId === avatar.id}
                        mode="full"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <UserCircle className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <p className="text-gray-500">
                      {searchTerm ? 'No avatars match your search' : 'No avatars yet. Add your first avatar to use in video generation.'}
                    </p>
                  </div>
                )}
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

      <EditProductModal
        isOpen={!!editingProduct}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onProductUpdated={handleProductUpdated}
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

      <CreateAvatarModal
        isOpen={showCreateAvatarModal}
        onClose={() => setShowCreateAvatarModal(false)}
        onAvatarCreated={handleAvatarCreated}
      />

      <EditAvatarModal
        isOpen={!!editingAvatar}
        avatar={editingAvatar}
        onClose={() => setEditingAvatar(null)}
        onAvatarUpdated={handleAvatarUpdated}
      />
    </div>
  );
}
