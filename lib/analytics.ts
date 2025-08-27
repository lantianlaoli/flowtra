// Core Web Vitals monitoring for SEO
interface WebVitalMetric {
  name: string;
  id: string;
  value: number;
}

declare global {
  function gtag(command: string, action: string, parameters: Record<string, unknown>): void;
}

export function reportWebVitals(metric: WebVitalMetric) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Core Web Vitals:', metric);
  }

  // Send to analytics service in production
  if (process.env.NODE_ENV === 'production') {
    // Send to Google Analytics or other analytics service
    if (typeof gtag !== 'undefined') {
      gtag('event', metric.name, {
        event_category: 'Web Vitals',
        event_label: metric.id,
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        non_interaction: true,
      });
    }
  }

  // Critical thresholds for SEO
  const thresholds = {
    FCP: 1800, // First Contentful Paint
    LCP: 2500, // Largest Contentful Paint  
    FID: 100,  // First Input Delay
    CLS: 0.1,  // Cumulative Layout Shift
    TTFB: 600, // Time to First Byte
  };

  // Log performance issues
  if (metric.value > thresholds[metric.name as keyof typeof thresholds]) {
    console.warn(`⚠️ Poor ${metric.name}: ${metric.value} (threshold: ${thresholds[metric.name as keyof typeof thresholds]})`);
  }
}

// SEO-focused performance tracking
export const trackSEOMetrics = () => {
  if (typeof window !== 'undefined') {
    // Track Time to Interactive for SEO
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          console.log('FCP for SEO:', entry.startTime);
        }
      }
    }).observe({ entryTypes: ['paint'] });
  }
};