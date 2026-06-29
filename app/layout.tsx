import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs';
import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { DeferredAnalytics } from '@/components/analytics/DeferredAnalytics';
import { CookieConsentManager } from '@/components/consent/CookieConsentManager';
import FloatingPreferences from '@/components/layout/FloatingPreferences';
import { CookieConsentProvider } from '@/providers/cookie-consent';
import { I18nProvider } from '@/providers/I18nProvider';
import { ToastProvider } from '@/contexts/ToastContext';
import {
  getDocumentLang,
  resolveInitialSiteLocale,
  SITE_LOCALE_COOKIE_KEY,
} from '@/lib/i18n/site';
import { DEFAULT_SOCIAL_IMAGE_PATH } from '@/lib/social-image';
import { SITE_URL, siteUrl } from '@/lib/seo';
import { DASHBOARD_THEME_STORAGE_KEY } from '@/lib/theme';
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";

const LEGACY_CLERK_PUBLISHABLE_KEY = "pk_live_Y2xlcmsuZmxvd3RyYS5zdG9yZSQ";
const FLOWTRA_CLERK_PUBLISHABLE_KEY = "pk_live_Y2xlcmsuZmxvd3RyYS5haSQ=";

function resolveClerkPublishableKey() {
  const configuredKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (configuredKey === LEGACY_CLERK_PUBLISHABLE_KEY) {
    return FLOWTRA_CLERK_PUBLISHABLE_KEY;
  }

  return configuredKey;
}

export const metadata: Metadata = {
  title: "Turn Viral Videos Into Your Own with AI - Flowtra | Clone TikTok & Instagram Ads",
  description: "Turn viral TikTok ads and Instagram Reels into your own with AI. Clone proven UGC videos for your products. From $0.30/8s. No editing skills needed.",
  keywords: [
    // Primary viral + cloning keywords
    "turn viral videos into your own",
    "clone viral TikTok ads",
    "clone viral UGC videos",
    "replicate viral Instagram Reels",
    "copy viral videos",
    // Core cloning keywords
    "clone viral videos",
    "clone TikTok ads",
    "replicate Instagram Reels",
    "viral video replication",
    "clone YouTube Shorts",
    // Viral-focused long-tail
    "how to turn viral videos into your own",
    "clone viral marketing videos",
    "replicate viral TikTok ads",
    "copy viral UGC content",
    // Long-tail keywords
    "how to clone viral ads",
    "AI video cloning tool",
    "replicate viral marketing videos",
    "TikTok ad replication software",
    "Instagram Reels cloning AI",
    // Audience-specific with viral angle
    "clone viral ads for Shopify",
    "replicate viral TikTok videos for dropshipping",
    "copy viral UGC for small business",
    // Platform-specific
    "TikTok ad cloning AI",
    "Instagram Reels replication tool",
    "viral video cloning software",
    // Keep existing relevant keywords
    "UGC video maker",
    "small business video ads",
    "Shopify product videos",
    "dropshipping video ads",
    "AI video generator for Etsy",
    "Gumroad marketing tool",
    "Stan creators AI",
    "free AI video generator",
    "unlimited AI image maker",
    "AI marketing tool for small business",
    "product photo to video AI",
    "TikTok ad maker AI",
    "Instagram Reels AI video",
    "Etsy product showcase generator",
    "Shopify ad automation",
    "digital product promo video",
    "creator economy marketing AI"
  ],
  authors: [{ name: "Flowtra Team" }],
  creator: "Flowtra",
  publisher: "Flowtra",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Turn Viral Videos Into Your Own with AI - Flowtra",
  description: "Clone viral TikTok ads, Instagram Reels, and YouTube Shorts with AI. Built for Shopify sellers and small businesses. From $0.30 per 8 seconds.",
    url: SITE_URL,
    siteName: 'Flowtra',
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: 'Turn Viral Videos Into Your Own - Flowtra AI Clone Viral UGC',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Turn Viral Videos Into Your Own - Flowtra AI',
    description: 'Clone viral TikTok & Instagram ads with AI. Proven creative for your products. From $0.30/8s.',
    images: [DEFAULT_SOCIAL_IMAGE_PATH],
    creator: '@flowtra',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'msapplication-TileColor': '#ffffff',
  },
  category: 'technology',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const initialLocale = resolveInitialSiteLocale({
    cookieLocale: cookieStore.get(SITE_LOCALE_COOKIE_KEY)?.value,
    countryCode: headerStore.get('x-vercel-ip-country'),
  });
  const themeBootstrapScript = `
    (() => {
      try {
        const stored = window.localStorage.getItem('${DASHBOARD_THEME_STORAGE_KEY}');
        const enabled = stored === 'true'
          ? true
          : stored === 'false'
            ? false
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.classList.toggle('dashboard-theme', enabled);
        const applyToBody = () => document.body?.classList.toggle('dashboard-theme', enabled);
        applyToBody();
        if (!document.body) {
          window.addEventListener('DOMContentLoaded', applyToBody, { once: true });
        }
      } catch {}
    })();
  `;

  return (
    <ClerkProvider
      publishableKey={resolveClerkPublishableKey()}
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <html lang={getDocumentLang(initialLocale)} suppressHydrationWarning={true}>
        <head>
          <meta name="google-site-verification" content="0ORMaGX3SE1VfBZOGIUQlYpSfcQB94AidOZRovm66GQ" />
          <meta name="theme-color" content="#ffffff" />
          <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="shortcut icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: 'Flowtra AI - Turn Viral Videos Into Your Own | Clone Viral UGC',
                description: 'AI-powered video cloning platform that transforms viral UGC videos into your own. Clone TikTok ads, Instagram Reels, and YouTube Shorts with your products. Built for Shopify, dropshipping, and small businesses.',
                url: SITE_URL,
                applicationCategory: 'BusinessApplication',
                operatingSystem: 'Web',
                browserRequirements: 'Requires JavaScript. Requires HTML5.',
                softwareVersion: '1.0',
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: '4.8',
                  ratingCount: '150'
                },
                offers: [
                  {
                    '@type': 'Offer',
                    name: 'Lite Package',
                    price: '9',
                    priceCurrency: 'USD',
                    category: 'AI Marketing Tools',
                    description: '500 credits for AI video and image generation'
                  },
                  {
                    '@type': 'Offer',
                    name: 'Basic Package',
                    price: '29',
                    priceCurrency: 'USD',
                    category: 'AI Marketing Tools',
                    description: '2,000 credits for multi-platform video, image, and ad copy creation'
                  },
                  {
                    '@type': 'Offer',
                    name: 'Pro Package',
                    price: '49',
                    priceCurrency: 'USD',
                    category: 'AI Marketing Tools',
                    description: '3,500 credits with priority rendering and template unlocks'
                  }
                ],
                publisher: {
                  '@type': 'Organization',
                  name: 'Flowtra',
                  url: SITE_URL,
                  logo: {
                    '@type': 'ImageObject',
                    url: `${SITE_URL}/logo.svg`,
                    width: '200',
                    height: '60'
                  }
                },
                featureList: [
                  'AI video generator for Etsy and Shopify sellers',
                  'Unlimited free video and image generations',
                  'One-time pricing plans starting at $9',
                  'Template-based ads for Gumroad and Stan creators',
                  'Beginner-friendly marketing video builder',
                  'Upload product photos and get ads in minutes',
                  'Commercial usage rights with no watermarks'
                ],
                screenshot: `${SITE_URL}/app-screenshot.jpg`,
                video: {
                  '@type': 'VideoObject',
                  name: 'Flowtra Demo - AI Ad Generation',
                  description: 'See how Flowtra creates professional video advertisements from product photos using advanced AI technology',
                  thumbnailUrl: `${SITE_URL}/demo-thumbnail.jpg`,
                  uploadDate: '2024-01-15T12:00:00+00:00',
                  contentUrl: `${SITE_URL}/demo-video.mp4`,
                  duration: 'PT45S',
                  embedUrl: `${SITE_URL}/demo-video-embed`,
                  publisher: {
                    '@type': 'Organization',
                    name: 'Flowtra',
                    logo: {
                      '@type': 'ImageObject',
                      url: `${SITE_URL}/logo.svg`
                    }
                  }
                }
              })
            }}
          />
        </head>
        <body className="font-sans antialiased">
          <I18nProvider initialLocale={initialLocale}>
            <CookieConsentProvider>
              <ToastProvider>
                <FloatingPreferences />
                {children}
              </ToastProvider>
              <CookieConsentManager />
              <DeferredAnalytics />
            </CookieConsentProvider>
          </I18nProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
