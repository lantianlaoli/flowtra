'use client';

import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import DashboardContentTransition from '@/components/layout/DashboardContentTransition';
import AssetsManager from '@/components/AssetsManager';
import { useI18n } from '@/providers/I18nProvider';

export default function AssetsPage() {
  const { messages } = useI18n();
  const assetsMessages = messages.dashboard.assets;
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();

  if (!isLoaded) {
    return <div className="flex">{messages.common.loading}</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        credits={userCredits}
        userEmail={user?.emailAddresses?.[0]?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <DashboardContentTransition className="dashboard-content-offset ml-0 bg-background min-h-screen">
        <div className="px-8 md:px-12 lg:px-16 pb-12 max-w-[1280px] mx-auto pt-16 md:pt-12">
          {/* Header - Minimalist with generous spacing */}
          <div className="mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground tracking-tight mb-3">
              {assetsMessages.title}
            </h1>
            <p className="text-base text-muted-foreground">
              {assetsMessages.description}
            </p>
          </div>

          {/* Assets Manager */}
          <AssetsManager />
        </div>
      </DashboardContentTransition>
    </div>
  );
}
