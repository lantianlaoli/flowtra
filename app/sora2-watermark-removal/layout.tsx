'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/contexts/ToastContext';

export default function SoraWatermarkRemovalLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
