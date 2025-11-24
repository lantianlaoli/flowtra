'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, ChevronDown, ChevronRight, Plus, Package, Target } from 'lucide-react';
import { UserBrand, UserProduct } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from './ProductCard';
import ConfirmDialog from './ConfirmDialog';
import CompetitorAdsList from './CompetitorAdsList';

interface BrandSectionProps {
  brand: UserBrand & { products?: UserProduct[] };
  onEditBrand: (brand: UserBrand) => void;
  onDeleteBrand: (brandId: string) => void;
  onViewProduct: (product: UserProduct) => void;
  onEditProduct: (product: UserProduct) => void;
  onDeleteProduct: (productId: string) => void;
  onAddProductToBrand: (brandId: string, mode: 'create' | 'select') => void;
  defaultExpanded?: boolean;
  deletingProductId?: string | null;
}

export default function BrandSection({
  brand,
  onEditBrand,
  onDeleteBrand,
  onViewProduct,
  onEditProduct,
  onDeleteProduct,
  onAddProductToBrand,
  defaultExpanded = false,
  deletingProductId = null
}: BrandSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'competitors'>('products');
  const [competitorCount, setCompetitorCount] = useState(0);
  const products = brand.products || [];

  // Fetch competitor count
  useEffect(() => {
    const fetchCompetitorCount = async () => {
      try {
        const response = await fetch(`/api/competitor-ads?brandId=${brand.id}`);
        if (response.ok) {
          const data = await response.json();
          setCompetitorCount(data.competitorAds?.length || 0);
        }
      } catch (error) {
        console.error('Error fetching competitor count:', error);
      }
    };
    fetchCompetitorCount();
  }, [brand.id]);

  const handleDeleteBrand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    onDeleteBrand(brand.id);
  };

  const handleEditBrand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditBrand(brand);
  };

  const handleAddProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddProductToBrand(brand.id, 'create');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Brand Header */}
      <motion.div
        className="p-3 md:p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 md:gap-4">
          {/* Expand/Collapse Icon */}
          <button
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />
            ) : (
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            )}
          </button>

          {/* Brand Logo */}
          <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
            {brand.brand_logo_url ? (
              <Image
                src={brand.brand_logo_url}
                alt={brand.brand_name}
                fill
                className="object-contain p-1.5 md:p-2"
                sizes="(max-width: 768px) 48px, 64px"
              />
            ) : (
              <span className="text-gray-500 font-semibold">
                {brand.brand_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Brand Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base md:text-lg truncate">
              {brand.brand_name}
            </h3>
            {(brand.brand_slogan || brand.brand_details) && (
              <p className="text-gray-600 text-xs md:text-sm line-clamp-1 mt-0.5">
                {brand.brand_slogan || brand.brand_details}
              </p>
            )}
            <div className="flex items-center gap-3 md:gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <Package className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {products.length} {products.length === 1 ? 'product' : 'products'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 md:w-3.5 md:h-3.5 text-purple-400" />
                <span className="text-xs text-gray-500">
                  {competitorCount} {competitorCount === 1 ? 'competitor' : 'competitors'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={handleEditBrand}
              className="p-1.5 md:p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit brand"
            >
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>

            {/* Delete button - always visible on mobile, hover-based on desktop */}
            <button
              onClick={handleDeleteBrand}
              className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors sm:hidden"
              title="Delete brand"
            >
              <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>

            <AnimatePresence>
              {isHovered && (
                <motion.button
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleDeleteBrand}
                  className="p-1.5 md:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors hidden sm:block"
                  title="Delete brand"
                >
                  <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Content Tabs (Collapsible) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100">
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200 px-3 md:px-4">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === 'products'
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <Package className="w-4 h-4" />
                  Products ({products.length})
                </button>
                <button
                  onClick={() => setActiveTab('competitors')}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === 'competitors'
                      ? 'border-purple-600 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  <Target className="w-4 h-4" />
                  Competitors
                </button>
              </div>

              {/* Tab Content */}
              <div className="px-3 md:px-4 py-3 md:py-4">
                {activeTab === 'products' ? (
                  /* Products Content */
                  products.length === 0 ? (
                    <div className="text-center py-6 md:py-8 text-gray-400">
                      <Package className="w-8 h-8 md:w-10 md:h-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-xs md:text-sm">No products in this brand yet</p>
                      <button
                        onClick={handleAddProduct}
                        className="mt-2 md:mt-3 text-xs md:text-sm text-gray-600 hover:text-gray-900 underline"
                      >
                        Add your first product
                      </button>
                    </div>
                  ) : (
                    <div>
                      {/* Products Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-gray-600" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            Products ({products.length})
                          </h3>
                        </div>
                        <button
                          onClick={handleAddProduct}
                          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Product
                        </button>
                      </div>
                      {/* Products Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                      {products.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onView={onViewProduct}
                          onEditClick={onEditProduct}
                          onDelete={onDeleteProduct}
                          isDeleting={deletingProductId === product.id}
                          mode="compact"
                        />
                      ))}
                      </div>
                    </div>
                  )
                ) : (
                  /* Competitors Content */
                  <CompetitorAdsList
                    brandId={brand.id}
                    brandName={brand.brand_name}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Brand Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Brand"
        message={
          products.length > 0
            ? `Are you sure you want to delete "${brand.brand_name}"? This will unlink ${products.length} ${products.length === 1 ? 'product' : 'products'} from this brand (products won't be deleted).`
            : `Are you sure you want to delete "${brand.brand_name}"?`
        }
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
