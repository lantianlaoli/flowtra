import type { Metadata } from "next";
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { PHProvider, PostHogPageView } from '@/providers/posthog';
import { ToastProvider } from '@/contexts/ToastContext';
import "./globals.css";

export const metadata: Metadata = {
  title: "Turn Viral Videos Into Your Own with AI - Flowtra | Clone TikTok & Instagram Ads",
  description: "Turn your competitors' viral TikTok ads and Instagram Reels into your own with AI. Clone proven UGC videos for your products. From $0.30/8s. No editing skills needed.",
  keywords: [
    // Primary viral + cloning keywords
    "turn viral videos into your own",
    "clone viral TikTok ads",
    "clone viral UGC videos",
    "replicate viral Instagram Reels",
    "copy viral competitor videos",
    // Core cloning keywords
    "clone competitor videos",
    "clone TikTok ads",
    "replicate Instagram Reels",
    "competitor video replication",
    "clone YouTube Shorts",
    // Viral-focused long-tail
    "how to turn competitor videos into your own",
    "clone viral marketing videos",
    "replicate viral TikTok ads",
    "copy viral UGC content",
    // Long-tail keywords
    "how to clone competitor ads",
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
  metadataBase: new URL('https://www.flowtra.store'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Turn Viral Videos Into Your Own with AI - Flowtra",
    description: "Clone your competitors' viral TikTok ads, Instagram Reels, and YouTube Shorts with AI. Built for Shopify sellers and small businesses. From $0.30 per 8 seconds.",
    url: 'https://www.flowtra.store',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Turn Viral Videos Into Your Own - Flowtra AI Clone Competitor UGC',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Turn Viral Videos Into Your Own - Flowtra AI',
    description: 'Clone competitors\' viral TikTok & Instagram ads with AI. Proven creative for your products. From $0.30/8s.',
    images: ['/twitter-image.png'],
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
  icons: {
    icon: [
      '/favicon.ico',
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  },
  other: {
    'msapplication-TileColor': '#ffffff',
    'msapplication-TileImage': '/ms-icon-150x150.png',
    'msapplication-config': '/browserconfig.xml',
  },
  manifest: '/site.webmanifest',
  category: 'technology',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signUpForceRedirectUrl="/select-plan"
      signInFallbackRedirectUrl="/dashboard"
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <html lang="en" suppressHydrationWarning={true}>
        <head>
          <meta name="google-site-verification" content="s9LILAiVY8VS08_NWNu9kW3hdlnlQgDMa-Hy1y1Ly3A" />
          <meta name="theme-color" content="#ffffff" />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: 'Flowtra AI - Turn Viral Videos Into Your Own | Clone Competitor UGC',
                description: 'AI-powered video cloning platform that transforms competitors\' viral UGC videos into your own. Clone TikTok ads, Instagram Reels, and YouTube Shorts with your products. Built for Shopify, dropshipping, and small businesses.',
                url: 'https://www.flowtra.store',
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
                    description: '500 credits for AI video and image generation with unlimited free trials'
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
                  url: 'https://www.flowtra.store',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://www.flowtra.store/logo.png',
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
                screenshot: 'https://www.flowtra.store/app-screenshot.jpg',
                video: {
                  '@type': 'VideoObject',
                  name: 'Flowtra Demo - AI Ad Generation',
                  description: 'See how Flowtra creates professional video advertisements from product photos using advanced AI technology',
                  thumbnailUrl: 'https://www.flowtra.store/demo-thumbnail.jpg',
                  uploadDate: '2024-01-15T12:00:00+00:00',
                  contentUrl: 'https://www.flowtra.store/demo-video.mp4',
                  duration: 'PT45S',
                  embedUrl: 'https://www.flowtra.store/demo-video-embed',
                  publisher: {
                    '@type': 'Organization',
                    name: 'Flowtra',
                    logo: {
                      '@type': 'ImageObject',
                      url: 'https://www.flowtra.store/logo.png'
                    }
                  }
                }
              })
            }}
          />
        </head>
        <body className="font-sans antialiased">
          <Script
            src="https://www.googletagmanager.com/gtag/js?id=G-CP7HSQFTCP"
            strategy="lazyOnload"
          />
          <Script id="google-analytics" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-CP7HSQFTCP');
            `}
          </Script>
          <PHProvider>
            <ToastProvider>
              <PostHogPageView />
              {children}
            </ToastProvider>
          </PHProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
