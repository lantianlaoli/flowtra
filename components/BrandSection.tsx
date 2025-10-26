'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, ChevronDown, ChevronRight, Plus, Package } from 'lucide-react';
import { UserBrand, UserProduct } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import ProductItem from './ProductItem';
import ConfirmDialog from './ConfirmDialog';

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const products = brand.products || [];

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
          <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0 bg-gray-50 rounded-lg overflow-hidden">
            <Image
              src={brand.brand_logo_url}
              alt={brand.brand_name}
              fill
              className="object-contain p-1.5 md:p-2"
              sizes="(max-width: 768px) 48px, 64px"
            />
          </div>

          {/* Brand Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base md:text-lg truncate">
              {brand.brand_name}
            </h3>
            {brand.brand_slogan && (
              <p className="text-gray-600 text-xs md:text-sm line-clamp-1 mt-0.5">
                {brand.brand_slogan}
              </p>
            )}
            <div className="flex items-center gap-1.5 md:gap-2 mt-1">
              <Package className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">
                {products.length} {products.length === 1 ? 'product' : 'products'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Add Product Button */}
            <button
              onClick={handleAddProduct}
              className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 text-xs md:text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Add product to this brand"
            >
              <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">Add Product</span>
            </button>

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
            <div className="px-3 md:px-4 pb-3 md:pb-4 pt-2 space-y-3 border-t border-gray-100">
              {products.length === 0 ? (
                <div className="ml-4 md:ml-8 text-center py-6 md:py-8 text-gray-400">
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
                products.map((product) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    onEdit={onEditProduct}
                    onDelete={onDeleteProduct}
                    onPhotoUpload={onPhotoUpload}
                    onDeletePhoto={onDeletePhoto}
                    indented={true}
                  />
                ))
              )}
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
