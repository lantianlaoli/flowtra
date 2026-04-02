export const DASHBOARD_THEME_STORAGE_KEY = 'flowtra-dashboard-dark';

export function getPreferredDashboardTheme(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const stored = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);
  if (stored === 'true') return true;
  if (stored === 'false') return false;

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyDashboardTheme(enabled: boolean) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dashboard-theme', enabled);
  document.body.classList.toggle('dashboard-theme', enabled);
}
