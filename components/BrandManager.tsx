'use client';

import { useState, useEffect } from 'react';
import { Plus, Tag, Search, Loader2 } from 'lucide-react';
import { UserBrand } from '@/lib/supabase';
import BrandCard from './BrandCard';
import CreateBrandModal from './CreateBrandModal';
import EditBrandModal from './EditBrandModal';

interface BrandManagerProps {
  onBrandSelect?: (brand: UserBrand) => void;
  selectedBrandId?: string;
  selectable?: boolean;
}

export default function BrandManager({
  onBrandSelect,
  selectedBrandId,
  selectable = false
}: BrandManagerProps) {
  const [brands, setBrands] = useState<(UserBrand & { product_count?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<UserBrand | null>(null);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      const response = await fetch('/api/user-brands');
      if (response.ok) {
        const data = await response.json();
        setBrands(data.brands || []);
      }
    } catch (error) {
      console.error('Error loading brands:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrandCreated = (newBrand: UserBrand) => {
    setBrands(prev => [{ ...newBrand, product_count: 0 }, ...prev]);
  };

  const handleBrandUpdated = (updatedBrand: UserBrand) => {
    setBrands(prev => prev.map(b =>
      b.id === updatedBrand.id ? { ...updatedBrand, product_count: b.product_count } : b
    ));
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
        setBrands(prev => prev.filter(b => b.id !== brandId));
      }
    } catch (error) {
      console.error('Error deleting brand:', error);
    }
  };

  const filteredBrands = brands.filter(brand =>
    brand.brand_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (brand.brand_slogan?.toLowerCase() || '').includes(searchTerm.toLowerCase())
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
            <Tag className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              {selectable ? 'Select Brand' : 'My Brands'}
            </h2>
          </div>
          {!selectable && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Brand
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search brands..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>

      {/* Brands Grid */}
      <div className="p-6">
        {filteredBrands.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Tag className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No brands found</h3>
            <p className="text-sm">
              {searchTerm ? 'Try adjusting your search terms' : 'Create your first brand to get started'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredBrands.map((brand) => (
              <BrandCard
                key={brand.id}
                brand={brand}
                onEdit={handleEditBrand}
                onDelete={handleDeleteBrand}
                onSelect={onBrandSelect}
                isSelected={selectedBrandId === brand.id}
                selectable={selectable}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Brand Modal */}
      <CreateBrandModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onBrandCreated={handleBrandCreated}
      />

      {/* Edit Brand Modal */}
      <EditBrandModal
        isOpen={!!editingBrand}
        brand={editingBrand}
        onClose={() => setEditingBrand(null)}
        onBrandUpdated={handleBrandUpdated}
      />
    </div>
  );
}
