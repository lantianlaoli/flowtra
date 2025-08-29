'use client';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  faqData: FAQItem[];
}

export default function FAQSchema({ faqData }: FAQSchemaProps) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer
      }
    }))
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(faqSchema)
      }}
    />
  );
}