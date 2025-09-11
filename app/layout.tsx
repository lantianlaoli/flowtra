import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs'
import { UserInitializer } from '@/components/UserInitializer'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowtra - AI-Powered E-commerce Ad Generation",
  description: "Transform product photos into professional video ads using AI. Generate Amazon, Walmart & local store advertisements in seconds. Start with 100 free credits - no signup required.",
  keywords: [
    "AI video ads",
    "product advertisement generator",
    "Amazon product ads",
    "Walmart advertising tools",
    "local store video ads",
    "e-commerce video creation",
    "automated marketing content",
    "AI advertisement maker",
    "retail store marketing videos",
    "AI video ads from photos",
    "create Amazon product videos with AI",
    "automated video ads for ecommerce",
    "product photo to video converter",
    "AI advertising tool for online stores"
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
    title: "Flowtra - AI-Powered E-commerce Ad Generation",
    description: "Transform product photos into professional video ads using AI. Generate Amazon, Walmart & local store advertisements in seconds. Start with 100 free credits - no signup required.",
    url: 'https://www.flowtra.store',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Flowtra - AI-Powered E-commerce Ad Generation',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flowtra - AI-Powered E-commerce Ad Generation',
    description: 'Transform product photos into professional video ads using AI. Generate Amazon, Walmart & local store ads. Start with 100 free credits.',
    images: ['/twitter-image.jpg'],
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
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#000000'
      }
    ]
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
                name: 'Flowtra - AI Ad Generator',
                description: 'AI-powered e-commerce advertisement generation platform that creates professional video ads and cover images from product photos using advanced machine learning.',
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
                    description: '500 credits for AI video generation'
                  },
                  {
                    '@type': 'Offer',
                    name: 'Basic Package',
                    price: '29',
                    priceCurrency: 'USD',
                    category: 'AI Marketing Tools',
                    description: '2,000 credits for AI video and image generation'
                  },
                  {
                    '@type': 'Offer',
                    name: 'Pro Package',
                    price: '49',
                    priceCurrency: 'USD',
                    category: 'AI Marketing Tools',
                    description: '3,500 credits with priority processing'
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
                  'AI Video Generation using VEO3 Models',
                  'Intelligent Product Image Analysis',
                  'Automated Advertisement Creation',
                  'Professional Cover Image Generation',
                  'Multi-Platform Export (Amazon, Walmart)',
                  'E-commerce Marketing Automation',
                  'Advanced Analytics and Performance Tracking'
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
          <CreditsProvider>
            <UserInitializer />
            {children}
          </CreditsProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
