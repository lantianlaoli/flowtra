import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE_URL } from '@/lib/social-image';
import { siteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: "Unofficial Codex Quota Reset Alerts | Flowtra",
  description:
    "Get email alerts when OpenAI official or staff posts on X about Codex quota resets, rate limits, and usage availability. Powered by Flowtra.",
  alternates: {
    canonical: "/tools/codex-quota-reset-alerts",
  },
  openGraph: {
    title: "Unofficial Codex Quota Reset Alerts | Flowtra",
    description:
      "Email alerts when OpenAI signals a Codex quota reset, rate-limit lift, or usage availability update on X.",
    url: siteUrl('/tools/codex-quota-reset-alerts'),
    siteName: "Flowtra",
    type: "website",
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Codex Quota Reset Alerts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unofficial Codex Quota Reset Alerts | Flowtra",
    description:
      "Email alerts when OpenAI signals a quota reset, rate-limit lift, or service availability update on X.",
    images: [DEFAULT_SOCIAL_IMAGE_URL],
  },
};

export default function CodexQuotaResetAlertsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
