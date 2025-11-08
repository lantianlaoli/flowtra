import type { Metadata } from "next";
import Sora2WatermarkRemovalLandingPage from '@/components/pages/Sora2WatermarkRemovalLandingPage';

export const metadata: Metadata = {
  title: "Sora2 Watermark Removal - Remove ChatGPT Sora Video Watermarks | Flowtra",
  description: "Remove watermarks from ChatGPT Sora2 videos instantly. Only 3 credits per video with automatic refund on failure. Professional quality watermark-free videos in 2-5 minutes.",
  keywords: [
    "Sora2 watermark removal",
    "ChatGPT Sora video",
    "remove Sora watermark",
    "Sora2 pro",
    "ChatGPT video watermark remover",
    "Sora video download without watermark",
    "OpenAI Sora watermark removal",
    "Sora2 video editor",
    "remove ChatGPT watermark",
    "Sora video processing",
    "professional Sora videos",
    "watermark-free Sora2",
  ],
  authors: [{ name: "Flowtra Team" }],
  creator: "Flowtra",
  publisher: "Flowtra",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/sora2-watermark-removal',
  },
  openGraph: {
    title: "Sora2 Watermark Removal - Remove ChatGPT Sora Video Watermarks | Flowtra",
    description: "Remove watermarks from ChatGPT Sora2 videos instantly. Only 3 credits per video with automatic refund on failure. Professional quality watermark-free videos in 2-5 minutes.",
    url: 'https://www.flowtra.store/sora2-watermark-removal',
    siteName: 'Flowtra',
    images: [
      {
        url: '/opengraph-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Sora2 Watermark Removal - Professional Video Processing',
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sora2 Watermark Removal - Remove ChatGPT Sora Video Watermarks',
    description: 'Remove watermarks from ChatGPT Sora2 videos instantly. Only 3 credits per video. Professional quality in 2-5 minutes.',
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
  category: 'technology',
};

export default function Page() {
  return <Sora2WatermarkRemovalLandingPage />;
}
