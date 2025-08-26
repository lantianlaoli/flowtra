import type { Metadata } from "next";
import { ClerkProvider } from '@clerk/nextjs'
import { UserInitializer } from '@/components/UserInitializer'
import { CreditsProvider } from '@/contexts/CreditsContext'
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowtra - AI-Powered E-commerce Ad Generation",
  description: "Generate professional video advertisements and cover images from product photos using AI. Automated marketing content creation for e-commerce businesses.",
  keywords: [
    "AI video generation",
    "e-commerce advertising", 
    "product ads",
    "marketing automation",
    "AI marketing tools",
    "video ad creator",
    "product photography",
    "advertisement generator"
  ],
  authors: [{ name: "Flowtra Team" }],
  creator: "Flowtra",
  publisher: "Flowtra",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://flowtra.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "Flowtra - AI-Powered E-commerce Ad Generation",
    description: "Generate professional video advertisements and cover images from product photos using AI. Automated marketing content creation for e-commerce businesses.",
    url: 'https://flowtra.com',
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
    description: 'Generate professional video advertisements and cover images from product photos using AI.',
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
    <ClerkProvider>
      <html lang="en">
        <head>
          <meta name="theme-color" content="#ffffff" />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebApplication',
                name: 'Flowtra',
                description: 'AI-powered e-commerce advertisement generation platform that creates professional video ads and cover images from product photos.',
                url: 'https://flowtra.com',
                applicationCategory: 'BusinessApplication',
                operatingSystem: 'Web',
                offers: {
                  '@type': 'Offer',
                  category: 'AI Marketing Tools'
                },
                creator: {
                  '@type': 'Organization',
                  name: 'Flowtra',
                  url: 'https://flowtra.com'
                },
                featureList: [
                  'AI Video Generation',
                  'Product Image Analysis', 
                  'Automated Ad Creation',
                  'Cover Image Generation',
                  'E-commerce Marketing'
                ]
              })
            }}
          />
        </head>
        <body className="antialiased">
          <UserInitializer />
          <CreditsProvider>
            {children}
          </CreditsProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}