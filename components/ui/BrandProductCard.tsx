'use client';

import { Package, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Brand {
  id: string;
  brand_name: string;
  brand_logo_url?: string;
  brand_slogan?: string;
}

interface Product {
  id: string;
  name?: string;
  product_name?: string;
  image_url?: string;
  photo_url?: string;
}

interface BrandProductCardProps {
  brand: Brand | null;
  product: Product | null;
  className?: string;
}

export default function BrandProductCard({
  brand,
  product,
  className
}: BrandProductCardProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <label className="flex items-center gap-2 text-base font-medium text-gray-900">
        Brand & Product
      </label>
      <div className="bg-white border-2 border-gray-300 rounded-md p-4">
        <div className="flex items-center gap-4">
          {/* Brand Section */}
          <div className="flex items-center gap-3 flex-1">
            {/* Brand Logo */}
            <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center border border-gray-300 flex-shrink-0 overflow-hidden">
              {brand?.brand_logo_url ? (
                <Image
                  src={brand.brand_logo_url}
                  alt={brand.brand_name}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <Building2 className="w-8 h-8 text-gray-400" />
              )}
            </div>

            {/* Brand Info */}
            <div className="flex flex-col gap-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {brand?.brand_name || 'No Brand Selected'}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {brand?.brand_slogan || 'No slogan'}
              </div>
            </div>
          </div>

          {/* Product Section */}
          <div className="flex items-center gap-3 flex-1">
            {/* Product Image */}
            <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center border border-gray-300 flex-shrink-0 overflow-hidden">
              {(product?.image_url || product?.photo_url) ? (
                <Image
                  src={product.image_url || product.photo_url || ''}
                  alt={product.product_name || product.name || 'Product'}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <Package className="w-8 h-8 text-gray-400" />
              )}
            </div>

            {/* Product Name */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {product?.product_name || product?.name || 'No Product Selected'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
