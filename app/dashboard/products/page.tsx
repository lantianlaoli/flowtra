'use client';

import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/layout/Sidebar';
import ProductManager from '@/components/ProductManager';
import { Package } from 'lucide-react';

export default function ProductsPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="flex">Loading...</div>;
  }

  return (
    <div className="flex">
      <Sidebar
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="flex-1 ml-72 bg-white min-h-screen">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900">
                My Products
              </h1>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed max-w-3xl">
              Manage your product library for quick selection in advertisements. Upload product photos and organize them for efficient use across all ad campaigns.
            </p>
          </div>

          {/* Product Manager */}
          <ProductManager />
        </div>
      </div>
    </div>
  );
}