import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === 'development';
const shouldDisableImageOptimization =
  isDevelopment || process.env.NEXT_DISABLE_IMAGE_OPTIMIZATION === '1';

const nextConfig: NextConfig = {
  compress: true,
  // Allow local dev access from both localhost and 127.0.0.1 so Next.js
  // does not treat asset requests as cross-origin during development.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  skipTrailingSlashRedirect: true, // Disable automatic trailing slash redirects.
  images: {
    // In some environments (e.g. local dev behind a browser proxy), the Next.js
    // image optimizer may not be able to reach upstream hosts even if the
    // browser can. Disabling optimization makes images load directly in the
    // client and avoids upstream timeout errors.
    unoptimized: shouldDisableImageOptimization,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'aywxqxpmmtgqzempixec.supabase.co' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'tempfile.aiquickdraw.com' },
      { protocol: 'https', hostname: 'webstatic.aiproxy.vip' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'img.turbo0.com' },
      { protocol: 'https', hostname: '*.tiktokcdn.com' },
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  modularizeImports: {
    '@heroicons/react/24/outline': {
      transform: '@heroicons/react/24/outline/{{member}}',
    },
    '@heroicons/react/24/solid': {
      transform: '@heroicons/react/24/solid/{{member}}',
    },
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@heroicons/react',
      'react-icons',
      'framer-motion',
      'react-markdown',
    ],
    proxyClientMaxBodySize: '500mb',
  },

  // The old webpack config block has been removed/disabled.
  // webpack: (config, { isServer }) => { ... },

  // Provide an empty Turbopack config to satisfy Next.js expectations.
  turbopack: {},

  async redirects() {
    return [
      {
        source: '/dashboard/generate',
        destination: '/dashboard/video-clone',
        permanent: false,
      },
      {
        source: '/dashboard/competitor-ugc-replication',
        destination: '/dashboard/video-clone',
        permanent: false,
      },
      {
        source: '/features/competitor-replica',
        destination: '/features/video-clone',
        permanent: true,
      },
      {
        source: '/features/viral-clone',
        destination: '/features/video-clone',
        permanent: true,
      },
      {
        source: '/sora2-watermark-removal',
        destination: '/',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/competitor-ugc-replication/:path*',
        destination: '/api/video-clone/:path*',
      },
      {
        source: '/api/public/competitor-ugc-replication-recent',
        destination: '/api/public/video-clone-recent',
      },
      {
        source: '/api/competitor-ads/:path*',
        destination: '/api/reference-videos/:path*',
      },
      {
        source: '/showcase/video-clone/reference-source.mp4',
        destination: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/clone_competitor_source.mp4',
      },
      {
        source: '/showcase/video-clone/reference-result.mp4',
        destination: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/clone_competitor_result.mp4',
      },
      {
        source: '/showcase/video-clone/reference-analysis.mp4',
        destination: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/site-assets/showcase/shared/videos/clone_competitor_parse.mp4',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        source: '/((?!api|_next/static|_next/image).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: isDevelopment
              ? 'no-cache'
              : 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: isDevelopment ? 'no-cache' : 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: isDevelopment ? 'no-cache' : 'public, max-age=31536000, immutable',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
      {
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: isDevelopment
              ? 'no-cache'
              : 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/(.*)\\.(css|js)$',
        headers: [
          {
            key: 'Cache-Control',
            value: isDevelopment ? 'no-cache' : 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
