'use client';

import { useState, useEffect } from 'react';
import { Tag, Plus } from 'lucide-react';
import { UserBrand } from '@/lib/supabase';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface BrandSelectorProps {
  selectedBrand: UserBrand | null;
  onBrandSelect: (brand: UserBrand | null) => void;
}

export default function BrandSelector({
  selectedBrand,
  onBrandSelect
}: BrandSelectorProps) {
  const [brands, setBrands] = useState<UserBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-900"></div>
      </div>
    );
  }

  if (brands.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
          <Tag className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-600 mb-3">No brands created yet</p>
        <a
          href="/dashboard/brands"
          className="inline-flex items-center gap-2 text-sm text-gray-900 hover:text-gray-700 font-medium"
        >
          <Plus className="w-4 h-4" />
          Create your first brand
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {/* None option */}
        <button
          onClick={() => onBrandSelect(null)}
          className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
            selectedBrand === null
              ? 'border-gray-900 bg-gray-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Tag className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-gray-900">No Brand</p>
            <p className="text-xs text-gray-600">Generate video without branded watermark</p>
          </div>
        </button>

        {/* Brand options */}
        {brands.map((brand) => (
          <motion.button
            key={brand.id}
            onClick={() => onBrandSelect(brand)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
              selectedBrand?.id === brand.id
                ? 'border-gray-900 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
              <Image
                src={brand.brand_logo_url}
                alt={brand.brand_name}
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{brand.brand_name}</p>
              {brand.brand_slogan && (
                <p className="text-xs text-gray-600 truncate">{brand.brand_slogan}</p>
              )}
            </div>
            {selectedBrand?.id === brand.id && (
              <div className="w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </motion.button>
        ))}
      </div>

      <a
        href="/dashboard/brands"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Manage brands
      </a>
    </div>
  );
}
