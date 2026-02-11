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
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        credits={userCredits}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="dashboard-content-offset ml-0 bg-background min-h-screen">
        <div className="px-8 md:px-12 lg:px-16 pb-12 max-w-[1280px] mx-auto pt-16 md:pt-12">
          {/* Header - Minimalist with generous spacing */}
          <div className="mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground tracking-tight mb-3">
              Assets
            </h1>
            <p className="text-base text-muted-foreground">
              Manage your products, avatars, and videos in one unified place
            </p>
          </div>

          {/* Assets Manager */}
          <AssetsManager />
        </div>
      </div>
    </div>
  );
}
