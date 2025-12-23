import type { ReactNode } from 'react';

// Minimal layout for plan selection (no sidebar, no dashboard chrome)
export default function SelectPlanLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
