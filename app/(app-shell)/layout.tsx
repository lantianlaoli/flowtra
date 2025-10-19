import type { ReactNode } from 'react';
import { AppShellProviders } from './providers';

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <AppShellProviders>
      {children}
    </AppShellProviders>
  );
}
