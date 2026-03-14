'use client';

import type { ReactNode } from 'react';
import { CreditsProvider } from '@/contexts/CreditsContext';

export function AppShellProviders({ children }: { children: ReactNode }) {
  return (
    <CreditsProvider>
      {children}
    </CreditsProvider>
  );
}
