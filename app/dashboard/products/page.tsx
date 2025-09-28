'use client';

import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import ProductManager from '@/components/ProductManager';
import { Package } from 'lucide-react';

export default function ProductsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();

  if (!isLoaded) {
    return <div className="flex">Loading...</div>;
  }

  return (
    <div className="flex">
      <Sidebar
        credits={userCredits}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="flex-1 ml-72 bg-white min-h-screen">
        <div className="max-w-7xl mx-auto p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Package className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
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