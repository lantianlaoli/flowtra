import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE_URL } from '@/lib/social-image';

export const metadata: Metadata = {
  title: "AI Ad Short Film | Flowtra",
  description:
    "Upload a product photo and generate a 15-second cinematic ad video with AI.",
  alternates: {
    canonical: "/tools/ad-short-film",
  },
  openGraph: {
    title: "AI Ad Short Film | Flowtra",
    description:
      "Upload a product photo and generate a 15-second cinematic ad video with AI.",
    url: "https://www.flowtra.store/tools/ad-short-film",
    siteName: "Flowtra",
    type: "website",
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Flowtra AI Ad Short Film",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Ad Short Film | Flowtra",
    description:
      "Upload a product photo and generate a 15-second cinematic ad video with AI.",
    images: [DEFAULT_SOCIAL_IMAGE_URL],
  },
};

export default function AdShortFilmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
