'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Edit2, Trash2, Package } from 'lucide-react';
import { UserBrand } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface BrandCardProps {
  brand: UserBrand & { product_count?: number };
  onEdit: (brand: UserBrand) => void;
  onDelete: (brandId: string) => void;
  onSelect?: (brand: UserBrand) => void;
  isSelected?: boolean;
  selectable?: boolean;
}

export default function BrandCard({
  brand,
  onEdit,
  onDelete,
  onSelect,
  isSelected = false,
  selectable = false
}: BrandCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${brand.brand_name}"? This action cannot be undone.`)) {
      onDelete(brand.id);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(brand);
  };

  const handleSelect = () => {
    if (selectable && onSelect) {
      onSelect(brand);
    }
  };

  return (
    <motion.div
      className={`
        bg-white rounded-xl border-2 transition-all duration-200 overflow-hidden
        ${selectable
          ? isSelected
            ? 'border-gray-900 shadow-lg ring-2 ring-gray-200 cursor-pointer'
            : 'border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer'
          : 'border-gray-200 hover:shadow-md'
        }
      `}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleSelect}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Brand Logo */}
      <div className="relative aspect-video bg-gray-50">
        <Image
          src={brand.brand_logo_url}
          alt={brand.brand_name}
          fill
          className="object-contain p-4"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </div>

      {/* Brand Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-lg truncate">
              {brand.brand_name}
            </h3>
            {brand.brand_slogan && (
              <p className="text-gray-600 text-sm line-clamp-2 mt-1">
                {brand.brand_slogan}
              </p>
            )}
          </div>

          {!selectable && (
            <div className="flex gap-2 ml-3">
              <button
                onClick={handleEdit}
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
                    onClick={handleDelete}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete brand"
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Product Count */}
        {brand.product_count !== undefined && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <Package className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {brand.product_count} {brand.product_count === 1 ? 'product' : 'products'}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
