'use client';

import type { ReactNode } from 'react';
import { CreditsProvider } from '@/contexts/CreditsContext';
import { UserInitializer } from '@/components/UserInitializer';

export function AppShellProviders({ children }: { children: ReactNode }) {
  return (
    <CreditsProvider>
      <UserInitializer />
      {children}
    </CreditsProvider>
  );
}
