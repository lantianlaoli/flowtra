'use client';

import { useState, useEffect } from 'react';
import { Plus, Package, Search, Loader2 } from 'lucide-react';
import { UserProduct } from '@/lib/supabase';
import ProductCard from './ProductCard';
import CreateProductModal from './CreateProductModal';

interface ProductManagerProps {
  onProductSelect?: (product: UserProduct) => void;
  selectedProductId?: string;
  selectable?: boolean;
}

export default function ProductManager({
  onProductSelect,
  selectedProductId,
  selectable = false
}: ProductManagerProps) {
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
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

  const handleProductCreated = (newProduct: UserProduct) => {
    setProducts(prev => [newProduct, ...prev]);
  };

  const handleEditProduct = async (productId: string, newName: string) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;

      // Update local state immediately for better UX
      setProducts(prev => prev.map(p =>
        p.id === productId ? { ...p, product_name: newName } : p
      ));

      // Then update on the server
      const response = await fetch(`/api/user-products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: newName,
          description: product.description
        })
      });

      if (!response.ok) {
        // If server update fails, revert the local change
        setProducts(prev => prev.map(p =>
          p.id === productId ? { ...p, product_name: product.product_name } : p
        ));
        throw new Error('Failed to update product name');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      // Note: Local state has already been reverted above if API call failed
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/user-products/${productId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setProducts(prev => prev.filter(p => p.id !== productId));
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
        await loadProducts(); // Refresh products to get updated photos
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
        await loadProducts(); // Refresh products to get updated photos
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  const filteredProducts = products.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {selectable ? 'Select Product' : 'My Products'}
            </h2>
          </div>
          {!selectable && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

      </div>

      {/* Products Grid */}
      <div className="p-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No products found</h3>
            <p className="text-sm">
              {searchTerm ? 'Try adjusting your search terms' : 'Create your first product to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={handleEditProduct}
                onDelete={handleDeleteProduct}
                onPhotoUpload={handlePhotoUpload}
                onDeletePhoto={handleDeletePhoto}
                onSelect={onProductSelect}
                isSelected={selectedProductId === product.id}
                mode={selectable ? 'selectable' : 'full'}
              />
            ))}
          </div>
        )}
      </div>


      {/* Create Product Modal */}
      <CreateProductModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onProductCreated={handleProductCreated}
      />
    </div>
  );
}