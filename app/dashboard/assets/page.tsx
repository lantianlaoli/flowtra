'use client';

import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import AssetsManager from '@/components/AssetsManager';
import { Boxes } from 'lucide-react';

export default function AssetsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();

  if (!isLoaded) {
    return <div className="flex">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={userCredits}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen pt-14 md:pt-0">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Boxes className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Assets
              </h1>
            </div>
            <p className="text-gray-600">
              Manage your brands and products in one unified place
            </p>
          </div>

          {/* Assets Manager */}
          <AssetsManager />
        </div>
      </div>
    </div>
  );
}
