import type { Metadata } from "next";
import Script from 'next/script';
import { ClerkProvider } from '@clerk/nextjs';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { PHProvider, PostHogPageView } from '@/providers/posthog';
import { ToastProvider } from '@/contexts/ToastContext';
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowtra AI - AI Video Generator for Etsy, Shopify & Gumroad Sellers",
  description: "Generate scroll-stopping marketing videos and product images in minutes. Flowtra helps Etsy, Shopify, Gumroad, and Stan sellers create ads with unlimited free generations and one-time plans starting at $9.",
  keywords: [
    "AI video maker for Etsy sellers",
    "Shopify product video generator",
    "Gumroad marketing tool",
    "Stan creators AI",
    "free AI video generator",
    "unlimited AI image maker",
    "AI tool no subscription",
    "one-time AI video tool",
    "AI video generator $9 plan",
    "customizable AI video templates",
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
    title: "Flowtra AI - AI Video Generator for Etsy, Shopify & Gumroad Sellers",
    description: "Generate scroll-stopping marketing videos and product images in minutes. Flowtra helps Etsy, Shopify, Gumroad, and Stan sellers create ads with unlimited free generations and one-time plans starting at $9.",
    url: 'https://www.flowtra.store',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Flowtra AI - Video Generator for Etsy, Shopify & Gumroad Sellers',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flowtra AI - AI Video Generator for Etsy, Shopify & Gumroad Sellers',
    description: 'Generate scroll-stopping marketing videos and product images in minutes. Unlimited free generations and one-time plans starting at $9.',
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
      signUpForceRedirectUrl="/dashboard"
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
                name: 'Flowtra AI - AI Video Generator for Etsy, Shopify & Gumroad Sellers',
                description: 'AI-powered marketing toolkit that turns product photos into scroll-stopping videos and images for Etsy, Shopify, Gumroad, and Stan sellers. Create campaigns in minutes with unlimited free generations.',
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
        <body className="antialiased">
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
