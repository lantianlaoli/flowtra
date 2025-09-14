import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs'
import { UserInitializer } from '@/components/UserInitializer'
import { CreditsProvider } from '@/contexts/CreditsContext'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowtra - AI Video Ads for Small Business | Under $1 Per Video",
  description: "Create professional video ads for your small business in under 1 minute. Transform product photos into Etsy, Amazon, Walmart & social media ads. Starting under $1/video - perfect for small retailers and creators.",
  keywords: [
    "Etsy video ads creator",
    "small business video ads under $1",
    "handmade product video marketing",
    "craft business advertising tools",
    "Etsy seller marketing videos",
    "AI video ads for small business",
    "product advertisement generator",
    "Amazon product ads",
    "Walmart advertising tools",
    "affordable AI marketing tools",
    "video ads for handmade products",
    "small retailer marketing videos",
    "AI video ads from photos",
    "under 1 minute video creation",
    "product photo to video converter",
    "cheap video ad generator",
    "craft business video marketing",
    "makers and creators video tools"
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
    title: "Flowtra - AI Video Ads for Small Business | Under $1 Per Video",
    description: "Create professional video ads for your small business in under 1 minute. Transform product photos into Etsy, Amazon, Walmart & social media ads. Starting under $1/video - perfect for small retailers and creators.",
    url: 'https://www.flowtra.store',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Flowtra - AI Video Ads for Small Business Under $1',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Flowtra - AI Video Ads for Small Business | Under $1 Per Video',
    description: 'Create professional video ads for your small business in under 1 minute. Transform product photos into Etsy, Amazon, Walmart & social media ads. Under $1/video.',
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
      '/favicon.ico',
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
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
                name: 'Flowtra - AI Video Ads for Small Business',
                description: 'AI-powered video advertisement generation platform designed for small businesses, Etsy sellers, makers and creators. Create professional video ads from product photos in under 1 minute for under $1.',
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
                  'AI Video Generation for Small Business',
                  'Under $1 Video Ad Creation',
                  'Etsy, Amazon, Walmart Ad Generation',
                  'Professional Video Ads in Under 1 Minute',
                  'Handmade Product Video Marketing',
                  'Small Retailer Marketing Automation',
                  'Craft Business Video Advertisement Tools'
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
