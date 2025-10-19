'use client';

import type { ReactNode } from 'react';
import { CreditsProvider } from '@/contexts/CreditsContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { UserInitializer } from '@/components/UserInitializer';

export function AppShellProviders({ children }: { children: ReactNode }) {
  return (
    <CreditsProvider>
      <ToastProvider>
        <UserInitializer />
        {children}
      </ToastProvider>
    </CreditsProvider>
  );
}
