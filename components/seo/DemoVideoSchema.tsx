'use client';

interface DemoVideoSchemaProps {
  videoUrl: string;
  title: string;
  description: string;
}

export default function DemoVideoSchema({ videoUrl, title, description }: DemoVideoSchemaProps) {
  const videoSchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description: description,
    thumbnailUrl: videoUrl.replace('.mp4', '-thumbnail.jpg'),
    uploadDate: new Date().toISOString(),
    contentUrl: videoUrl,
    embedUrl: videoUrl,
    duration: 'PT15S',
    publisher: {
      '@type': 'Organization',
      name: 'Flowtra',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.flowtra.store/logo.png'
      }
    },
    genre: ['Advertising', 'E-commerce', 'AI Technology'],
    keywords: [
      'AI video ads',
      'product advertisement',
      'Amazon ads', 
      'Walmart ads',
      'local store ads',
      'e-commerce video'
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '127'
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(videoSchema)
      }}
    />
  );
}