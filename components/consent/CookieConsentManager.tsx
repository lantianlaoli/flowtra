"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CookieConsentBanner } from "@/components/consent/CookieConsentBanner";
import { CookiePreferencesDialog } from "@/components/consent/CookiePreferencesDialog";
import { CookieSettingsLink } from "@/components/consent/CookieSettingsLink";
import { useCookieConsent } from "@/providers/cookie-consent";

export function CookieConsentManager() {
  const pathname = usePathname();
  const {
    consent,
    isHydrated,
    acceptAll,
    rejectNonEssential,
    savePreferences,
  } = useCookieConsent();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftAnalytics, setDraftAnalytics] = useState(false);
  const isDashboardRoute = pathname?.startsWith("/dashboard") ?? false;

  const shouldShowBanner = isHydrated && consent.status === "unknown" && !isDashboardRoute;

  const openPreferences = () => {
    setDraftAnalytics(consent.analytics);
    setDialogOpen(true);
  };

  const handleSave = () => {
    savePreferences({ analytics: draftAnalytics });
    setDialogOpen(false);
  };

  const handleAcceptAll = () => {
    acceptAll();
    setDraftAnalytics(true);
    setDialogOpen(false);
  };

  const handleRejectNonEssential = () => {
    rejectNonEssential();
    setDraftAnalytics(false);
    setDialogOpen(false);
  };

  const showSettingsLink = useMemo(
    () => isHydrated && !shouldShowBanner && !isDashboardRoute,
    [isDashboardRoute, isHydrated, shouldShowBanner],
  );

  return (
    <>
      {shouldShowBanner ? (
        <CookieConsentBanner
          onAcceptAll={handleAcceptAll}
          onRejectNonEssential={handleRejectNonEssential}
          onManagePreferences={openPreferences}
        />
      ) : null}

      {showSettingsLink ? <CookieSettingsLink onClick={openPreferences} /> : null}

      <CookiePreferencesDialog
        open={dialogOpen}
        analytics={draftAnalytics}
        onAnalyticsChange={setDraftAnalytics}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        onAcceptAll={handleAcceptAll}
        onRejectNonEssential={handleRejectNonEssential}
      />
    </>
  );
}
