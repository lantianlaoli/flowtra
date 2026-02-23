import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Multi-Angle Photo Tool | Flowtra",
  description:
    "Upload one frontal photo and generate 3 additional viewing angles. Supports products, people, and pets.",
  alternates: {
    canonical: "/tools/ai-angle-generator",
  },
  openGraph: {
    title: "AI Multi-Angle Photo Tool | Flowtra",
    description:
      "Upload one frontal photo and generate 3 additional viewing angles.",
    url: "https://www.flowtra.store/tools/ai-angle-generator",
    siteName: "Flowtra",
    type: "website",
    images: [
      {
        url: "https://www.flowtra.store/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Flowtra AI Multi-Angle Photo Tool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Multi-Angle Photo Tool | Flowtra",
    description:
      "Upload one frontal photo and generate 3 additional viewing angles.",
    images: ["https://www.flowtra.store/twitter-image.png"],
  },
};

export default function AiAngleGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
