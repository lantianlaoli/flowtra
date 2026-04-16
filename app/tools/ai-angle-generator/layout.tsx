import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE_URL } from '@/lib/social-image';

export const metadata: Metadata = {
  title: "Multi-Angle Photo Tool | Flowtra",
  description:
    "Upload one frontal photo and generate 3 additional viewing angles. Supports products, people, and pets.",
  alternates: {
    canonical: "/tools/ai-angle-generator",
  },
  openGraph: {
    title: "Multi-Angle Photo Tool | Flowtra",
    description:
      "Upload one frontal photo and generate 3 additional viewing angles.",
    url: "https://www.flowtra.store/tools/ai-angle-generator",
    siteName: "Flowtra",
    type: "website",
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Flowtra Multi-Angle Photo Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Multi-Angle Photo Tool | Flowtra",
    description:
      "Upload one frontal photo and generate 3 additional viewing angles.",
    images: [DEFAULT_SOCIAL_IMAGE_URL],
  },
};

export default function AiAngleGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
