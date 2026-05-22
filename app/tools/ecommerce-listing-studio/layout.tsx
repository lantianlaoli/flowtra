import type { Metadata } from "next";
import { DEFAULT_SOCIAL_IMAGE_URL } from '@/lib/social-image';

export const metadata: Metadata = {
  title: "Ecommerce Listing Studio | Flowtra",
  description:
    "Generate marketplace listing images, detail images, and product ad videos from ecommerce product photos.",
  alternates: {
    canonical: "/tools/ecommerce-listing-studio",
  },
  openGraph: {
    title: "Ecommerce Listing Studio | Flowtra",
    description:
      "Generate marketplace listing images, detail images, and product ad videos from ecommerce product photos.",
    url: "https://www.flowtra.store/tools/ecommerce-listing-studio",
    siteName: "Flowtra",
    type: "website",
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Flowtra Ecommerce Listing Studio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ecommerce Listing Studio | Flowtra",
    description:
      "Generate marketplace listing images, detail images, and product ad videos from ecommerce product photos.",
    images: [DEFAULT_SOCIAL_IMAGE_URL],
  },
};

export default function EcommerceListingStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
