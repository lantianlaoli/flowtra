"use client";

import { Cookie } from "lucide-react";

interface CookieSettingsLinkProps {
  onClick: () => void;
}

export function CookieSettingsLink({ onClick }: CookieSettingsLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="landing-press-button landing-press-button--secondary fixed bottom-4 left-4 z-[90] h-14 w-14 px-0 text-black"
      aria-label="Cookie settings"
      title="Cookie settings"
    >
      <Cookie size={34} strokeWidth={2.2} className="shrink-0 text-[#111111]" />
    </button>
  );
}
