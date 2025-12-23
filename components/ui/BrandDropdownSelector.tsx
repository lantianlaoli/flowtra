'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { UserBrand } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface BrandDropdownSelectorProps {
  selectedBrand: UserBrand | null;
  onSelect: (brand: UserBrand | null) => void;
  disabled?: boolean;
  className?: string;
}

export default function BrandDropdownSelector({
  selectedBrand,
  onSelect,
  disabled = false,
  className
}: BrandDropdownSelectorProps) {
  const [brands, setBrands] = useState<UserBrand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadBrands = async () => {
      try {
        const response = await fetch('/api/brands');
        if (response.ok) {
          const data = await response.json();
          setBrands(Array.isArray(data.brands) ? data.brands : []);
        }
      } catch (error) {
        console.error('Failed to load brands:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadBrands();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (brand: UserBrand) => {
    onSelect(brand);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'inline-flex items-center justify-between gap-3 px-4 h-12 border rounded-xl bg-white transition-all duration-200 min-w-[160px] outline-none',
          disabled ? 'bg-[#F1F1F1] border-[#E5E5E5] opacity-60 cursor-not-allowed' : 'border-[#E5E5E5] hover:border-[#CCCCCC] shadow-sm',
          isOpen && !disabled ? 'border-black ring-1 ring-black' : ''
        )}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
        ) : selectedBrand ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0 border border-gray-100">
              {selectedBrand.brand_logo_url ? (
                <Image
                  src={selectedBrand.brand_logo_url}
                  alt={selectedBrand.brand_name}
                  width={24}
                  height={24}
                  className="object-cover w-full h-full"
                />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-gray-500" />
              )}
            </div>
            <span className="text-sm font-medium text-black truncate">
              {selectedBrand.brand_name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-500">
            <Building2 className="w-4 h-4" />
            <span className="text-sm font-medium">Select brand</span>
          </div>
        )}
        <ChevronDown className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-20 bottom-full mb-2 w-72 rounded-xl border border-[#E5E5E5] bg-white shadow-xl overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {brands.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                No brands found. Visit Assets to create one.
              </div>
            ) : (
              brands.map(brand => (
                <button
                  type="button"
                  key={brand.id}
                  className={cn(
                    'w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition',
                    selectedBrand?.id === brand.id && 'bg-gray-50'
                  )}
                  onClick={() => handleSelect(brand)}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                    {brand.brand_logo_url ? (
                      <Image
                        src={brand.brand_logo_url}
                        alt={brand.brand_name}
                        width={32}
                        height={32}
                        className="object-cover"
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{brand.brand_name}</p>
                    {(brand.brand_slogan || brand.brand_details) && (
                      <p className="text-xs text-gray-500 truncate">
                        {brand.brand_slogan || brand.brand_details}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
