import { StandardAdsRecentList } from '@/components/StandardAdsRecentList';

export const revalidate = 0;

export default function McpDemoPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <section>
        <h1 className="text-3xl font-semibold text-neutral-900">Standard Ads MCP Demo</h1>
        <p className="mt-2 text-base text-neutral-600">
          This page shows the latest three public Standard Ads projects exposed through the{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-sm">/api/public/standard-ads-recent</code> endpoint.
          Use it to validate Model Context Protocol experiments locally without requiring authentication.
        </p>
      </section>

      <StandardAdsRecentList />
    </main>
  );
}

