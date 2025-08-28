interface VideoStructuredDataProps {
  name: string;
  description: string;
  contentUrl: string;
  thumbnailUrl?: string;
  duration?: string;
  uploadDate?: string;
}

export default function VideoStructuredData({
  name,
  description,
  contentUrl,
  thumbnailUrl,
  duration = 'PT30S',
  uploadDate = new Date().toISOString()
}: VideoStructuredDataProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name,
    description,
    contentUrl,
    ...(thumbnailUrl && { thumbnailUrl }),
    uploadDate,
    duration,
    publisher: {
      '@type': 'Organization',
      name: 'Flowtra',
      logo: {
        '@type': 'ImageObject',
        url: 'https://flowtra.com/logo.png'
      }
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData)
      }}
    />
  );
}