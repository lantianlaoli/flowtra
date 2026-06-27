import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE_URL } from '@/lib/social-image';
import { siteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: "Image Clone Tool | Flowtra",
  description:
    "Upload your product photo and reference images to generate a cloned commercial image.",
  alternates: {
    canonical: "/tools/image-clone",
  },
  openGraph: {
    title: "Image Clone Tool | Flowtra",
    description:
      "Upload your product photo and reference images to generate a cloned commercial image.",
    url: siteUrl('/tools/image-clone'),
    siteName: "Flowtra",
    type: "website",
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Flowtra Image Clone Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Image Clone Tool | Flowtra",
    description:
      "Upload your product photo and reference images to generate a cloned commercial image.",
    images: [DEFAULT_SOCIAL_IMAGE_URL],
  },
};

export default function ImageCloneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
