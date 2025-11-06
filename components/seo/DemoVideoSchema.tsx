interface DemoVideoSchemaProps {
  videoUrl: string;
  title: string;
  description: string;
}

export default function DemoVideoSchema({ videoUrl, title, description }: DemoVideoSchemaProps) {
  // Generate a deterministic upload date based on video URL to avoid hydration mismatch
  // This ensures server and client render the same content
  const getUploadDate = (url: string): string => {
    // Use a base date and add deterministic offset based on URL hash
    const baseDate = new Date('2024-01-15T10:00:00.000Z');
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Add deterministic days based on hash (0-30 days)
    const daysOffset = Math.abs(hash % 31);
    const uploadDate = new Date(baseDate);
    uploadDate.setDate(uploadDate.getDate() + daysOffset);

    return uploadDate.toISOString();
  };

  const videoSchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description: description,
    thumbnailUrl: videoUrl.replace('.mp4', '-thumbnail.jpg'),
    uploadDate: getUploadDate(videoUrl), // Now deterministic - same input = same output
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