'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, ChevronDown, ChevronRight, Plus, Package } from 'lucide-react';
import { UserBrand, UserProduct } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import ProductItem from './ProductItem';

interface BrandSectionProps {
  brand: UserBrand & { products?: UserProduct[] };
  onEditBrand: (brand: UserBrand) => void;
  onDeleteBrand: (brandId: string) => void;
  onEditProduct: (productId: string, newName: string) => void;
  onDeleteProduct: (productId: string) => void;
  onPhotoUpload: (productId: string, file: File) => void;
  onDeletePhoto: (productId: string, photoId: string) => void;
  onAddProductToBrand: (brandId: string, mode: 'create' | 'select') => void;
  onMoveProductFromBrand?: (productId: string) => void;
  defaultExpanded?: boolean;
}

export default function BrandSection({
  brand,
  onEditBrand,
  onDeleteBrand,
  onEditProduct,
  onDeleteProduct,
  onPhotoUpload,
  onDeletePhoto,
  onAddProductToBrand,
  onMoveProductFromBrand,
  defaultExpanded = false
}: BrandSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHovered, setIsHovered] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const products = brand.products || [];

  const handleDeleteBrand = (e: React.MouseEvent) => {
    e.stopPropagation();
    const productCount = products.length;
    const confirmMessage = productCount > 0
      ? `Are you sure you want to delete "${brand.brand_name}"? This will unlink ${productCount} ${productCount === 1 ? 'product' : 'products'} from this brand (products won't be deleted).`
      : `Are you sure you want to delete "${brand.brand_name}"?`;

    if (confirm(confirmMessage)) {
      onDeleteBrand(brand.id);
    }
  };

  const handleEditBrand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditBrand(brand);
  };

  const handleAddProduct = (e: React.MouseEvent, mode: 'create' | 'select') => {
    e.stopPropagation();
    setShowAddMenu(false);
    onAddProductToBrand(brand.id, mode);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Brand Header */}
      <motion.div
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          {/* Expand/Collapse Icon */}
          <button
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>

          {/* Brand Logo */}
          <div className="relative w-16 h-16 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden">
            <Image
              src={brand.brand_logo_url}
              alt={brand.brand_name}
              fill
              className="object-contain p-2"
              sizes="64px"
            />
          </div>

          {/* Brand Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-lg truncate">
              {brand.brand_name}
            </h3>
            {brand.brand_slogan && (
              <p className="text-gray-600 text-sm line-clamp-1 mt-0.5">
                {brand.brand_slogan}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Package className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">
                {products.length} {products.length === 1 ? 'product' : 'products'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Add Product Dropdown */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddMenu(!showAddMenu);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Add product to this brand"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {showAddMenu && (
                  <>
                    {/* Backdrop to close menu */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddMenu(false);
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20"
                    >
                      <button
                        onClick={(e) => handleAddProduct(e, 'create')}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                      >
                        <Plus className="w-4 h-4" />
                        <div>
                          <div className="font-medium">Create New Product</div>
                          <div className="text-xs text-gray-500">Add a new product to this brand</div>
                        </div>
                      </button>
                      <button
                        onClick={(e) => handleAddProduct(e, 'select')}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                      >
                        <Package className="w-4 h-4" />
                        <div>
                          <div className="font-medium">Select Existing</div>
                          <div className="text-xs text-gray-500">Choose from unbranded products</div>
                        </div>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={handleEditBrand}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit brand"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {isHovered && (
                <motion.button
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleDeleteBrand}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete brand"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Products List (Collapsible) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100">
              {products.length === 0 ? (
                <div className="ml-8 text-center py-8 text-gray-400">
                  <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No products in this brand yet</p>
                  <button
                    onClick={(e) => handleAddProduct(e, 'create')}
                    className="mt-3 text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    Add your first product
                  </button>
                </div>
              ) : (
                products.map((product) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    onEdit={onEditProduct}
                    onDelete={onDeleteProduct}
                    onPhotoUpload={onPhotoUpload}
                    onDeletePhoto={onDeletePhoto}
                    onMoveToBrand={onMoveProductFromBrand}
                    indented={true}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
