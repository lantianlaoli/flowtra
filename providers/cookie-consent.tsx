"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CookieConsentStatus =
  | "unknown"
  | "accepted"
  | "rejected"
  | "customized";

export interface CookieConsentState {
  status: CookieConsentStatus;
  analytics: boolean;
  updatedAt: string | null;
  version: number;
}

interface CookieConsentContextValue {
  consent: CookieConsentState;
  isHydrated: boolean;
  analyticsEnabled: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (options: { analytics: boolean }) => void;
}

const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_STORAGE_KEY = "flowtra_cookie_consent";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const defaultConsentState: CookieConsentState = {
  status: "unknown",
  analytics: false,
  updatedAt: null,
  version: COOKIE_CONSENT_VERSION,
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function parseStoredConsent(raw: string | null): CookieConsentState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsentState>;

    if (parsed.version !== COOKIE_CONSENT_VERSION) {
      return null;
    }

    return {
      status:
        parsed.status === "accepted" ||
        parsed.status === "rejected" ||
        parsed.status === "customized"
          ? parsed.status
          : "unknown",
      analytics: parsed.analytics === true,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      version: COOKIE_CONSENT_VERSION,
    };
  } catch {
    return null;
  }
}

function readConsentFromCookie(): CookieConsentState | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieEntry = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_CONSENT_STORAGE_KEY}=`));

  if (!cookieEntry) {
    return null;
  }

  const rawValue = cookieEntry.slice(COOKIE_CONSENT_STORAGE_KEY.length + 1);
  return parseStoredConsent(decodeURIComponent(rawValue));
}

function persistConsent(nextConsent: CookieConsentState) {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(nextConsent);
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, serialized);
  document.cookie = `${COOKIE_CONSENT_STORAGE_KEY}=${encodeURIComponent(
    serialized,
  )}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<CookieConsentState>(defaultConsentState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedLocalConsent = parseStoredConsent(
      window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY),
    );
    const storedConsent = storedLocalConsent ?? readConsentFromCookie();

    if (storedConsent) {
      setConsent(storedConsent);
    }

    setIsHydrated(true);
  }, []);

  const updateConsent = useCallback(
    (nextPartial: Pick<CookieConsentState, "status" | "analytics">) => {
      const nextConsent: CookieConsentState = {
        status: nextPartial.status,
        analytics: nextPartial.analytics,
        updatedAt: new Date().toISOString(),
        version: COOKIE_CONSENT_VERSION,
      };

      setConsent(nextConsent);
      persistConsent(nextConsent);
    },
    [],
  );

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      isHydrated,
      analyticsEnabled: consent.analytics,
      acceptAll: () => {
        updateConsent({ status: "accepted", analytics: true });
      },
      rejectNonEssential: () => {
        updateConsent({ status: "rejected", analytics: false });
      },
      savePreferences: ({ analytics }) => {
        updateConsent({
          status: "customized",
          analytics,
        });
      },
    }),
    [consent, isHydrated, updateConsent],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);

  if (!context) {
    throw new Error("useCookieConsent must be used within CookieConsentProvider");
  }

  return context;
}
