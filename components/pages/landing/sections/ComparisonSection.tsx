export default function ComparisonSection() {
  return (
    <div className="py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Why Choose Flowtra?</h2>
        <p className="text-base text-gray-600">Core advantages over other workflows</p>
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Desktop/tablet: comparison table */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-sm font-semibold text-gray-600 px-4 py-3 border-b border-gray-200 w-40">Feature</th>
                  <th className="text-left text-sm font-semibold px-4 py-3 border-b border-gray-200 bg-gray-900 text-white">Flowtra</th>
                  <th className="text-left text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">Traditional Ads</th>
                  <th className="text-left text-sm font-semibold text-gray-900 px-4 py-3 border-b border-gray-200">n8n Workflow</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="odd:bg-white even:bg-gray-50">
                  <td className="text-gray-600 px-4 py-3 border-b border-gray-100">Core Focus</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100 font-semibold bg-gray-50 border-x border-gray-200">AI ads for retail</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Manual production</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Manual AI setup</td>
                </tr>
                <tr className="odd:bg-white even:bg-gray-50">
                  <td className="text-gray-600 px-4 py-3 border-b border-gray-100">Ease of Use</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100 font-semibold bg-gray-50 border-x border-gray-200">Photo → Ad instantly</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Agency coordination</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Needs dev skills</td>
                </tr>
                <tr className="odd:bg-white even:bg-gray-50">
                  <td className="text-gray-600 px-4 py-3 border-b border-gray-100">Cost</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100 bg-gray-50 border-x border-gray-200 font-semibold">FREE photos • Pay when satisfied • &lt;$1 per ad</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">$500–$5000 per video</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">$20+/month + API costs</td>
                </tr>
                <tr className="odd:bg-white even:bg-gray-50">
                  <td className="text-gray-600 px-4 py-3 border-b border-gray-100">Platforms / Integrations</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100 bg-gray-50 border-x border-gray-200 font-semibold">Amazon, Walmart, Gumroad, Stan, Payhip, TikTok, Instagram, Local screens</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Any (manual delivery)</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Requires custom integrations</td>
                </tr>
                <tr className="odd:bg-white even:bg-gray-50">
                  <td className="text-gray-600 px-4 py-3 border-b border-gray-100">Learning</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100 bg-gray-50 border-x border-gray-200 font-semibold">Minutes</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Days</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Hours–days</td>
                </tr>
                <tr className="odd:bg-white even:bg-gray-50">
                  <td className="text-gray-600 px-4 py-3 border-b border-gray-100">Maintenance</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100 bg-gray-50 border-x border-gray-200 font-semibold">No pipelines to maintain</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Reshoots, edits, versions</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Maintain flows, tokens, failures</td>
                </tr>
                <tr className="odd:bg-white even:bg-gray-50">
                  <td className="text-gray-600 px-4 py-3 border-b border-gray-100">Timeline</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100 bg-gray-50 border-x border-gray-200 font-semibold">Seconds</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Days–weeks</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Hours–days</td>
                </tr>
                <tr className="odd:bg-white even:bg-gray-50">
                  <td className="text-gray-600 px-4 py-3 border-b border-gray-100">Best For</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100 bg-gray-50 border-x border-gray-200 font-semibold">E-commerce sellers & digital creators</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Established brands</td>
                  <td className="text-gray-900 px-4 py-3 border-b border-gray-100">Dev teams</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: stacked Flowtra + n8n cards */}
        <div className="md:hidden space-y-5 sm:space-y-6">
          {/* Flowtra Card */}
          <article className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Flowtra</h3>
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-900 text-white">Best Choice</span>
            </header>
            <dl className="text-sm border border-gray-100 rounded-md overflow-hidden">
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                <dt className="text-gray-500">Core Focus</dt>
                <dd className="text-gray-900 font-medium">AI ads for retail</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                <dt className="text-gray-500">Ease of Use</dt>
                <dd className="text-gray-900 font-medium">Photo → Ad instantly</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                <dt className="text-gray-500">Cost</dt>
                <dd className="text-gray-900">FREE photos • Pay when satisfied • &lt;$1 per ad</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                <dt className="text-gray-500">Platforms</dt>
                <dd className="text-gray-900">Amazon, Walmart, Gumroad, Stan, Payhip, TikTok, Instagram, Local screens</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                <dt className="text-gray-500">Learning</dt>
                <dd className="text-gray-900">Minutes</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                <dt className="text-gray-500">Maintenance</dt>
                <dd className="text-gray-900">No pipelines to maintain</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                <dt className="text-gray-500">Timeline</dt>
                <dd className="text-gray-900">Seconds</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                <dt className="text-gray-500">Best For</dt>
                <dd className="text-gray-900">E-commerce sellers & digital creators</dd>
              </div>
            </dl>
          </article>

          {/* n8n Card */}
          <article className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
            <header className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">n8n Workflow</h3>
            </header>
            <dl className="text-sm border border-gray-100 rounded-md overflow-hidden">
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                <dt className="text-gray-500">Core Focus</dt>
                <dd className="text-gray-900">Manual AI setup</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                <dt className="text-gray-500">Ease of Use</dt>
                <dd className="text-gray-900">Needs dev skills</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                <dt className="text-gray-500">Cost</dt>
                <dd className="text-gray-900">$20+/month + API costs</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                <dt className="text-gray-500">Integrations</dt>
                <dd className="text-gray-900">Requires custom integrations</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                <dt className="text-gray-500">Learning</dt>
                <dd className="text-gray-900">Hours–days</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                <dt className="text-gray-500">Maintenance</dt>
                <dd className="text-gray-900">Maintain flows, tokens, failures</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                <dt className="text-gray-500">Timeline</dt>
                <dd className="text-gray-900">Hours–days</dd>
              </div>
              <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                <dt className="text-gray-500">Best For</dt>
                <dd className="text-gray-900">Dev teams</dd>
              </div>
            </dl>
          </article>
        </div>
      </div>
    </div>
  );
}
