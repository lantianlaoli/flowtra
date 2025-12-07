export default function ComparisonSection() {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="text-center mb-12 px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">Arcads Alternative</h2>
        <p className="text-lg text-gray-600">Discover a superior alternative for your video generation needs</p>
      </div>

      <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-200 text-sm font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-4 w-48">Platform</th>
                <th className="px-6 py-4 w-64">Features</th>
                <th className="px-6 py-4 w-32">Billing Type</th>
                <th className="px-6 py-4 w-32">Cost</th>
                <th className="px-6 py-4">Included</th>
                <th className="px-6 py-4 w-40">Cost / Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Flowtra AI */}
              <tr className="bg-white hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-6 align-top">
                  <div className="font-bold text-lg text-black">Flowtra AI</div>
                </td>
                <td className="px-6 py-6 align-top text-gray-700 space-y-1">
                  <p>1. Character UGC Video Generation</p>
                  <p>2. Competitor UGC Video & Photo Cloning</p>
                </td>
                <td className="px-6 py-6 align-top text-gray-700">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    One-time
                  </span>
                </td>
                <td className="px-6 py-6 align-top font-bold text-black text-lg">
                  $29
                </td>
                <td className="px-6 py-6 align-top text-gray-700 space-y-2 text-sm">
                  <p>1. <span className="font-semibold text-black">2000 credits</span></p>
                  <p>2. Character UGC Video & Competitor Replica</p>
                  <p>3. Free, unlimited Veo3.1 Fast generation</p>
                  <p>4. 800 mins UGC video download quota (based on Veo3.1 Fast 20 credits/8 mins)</p>
                  <p>5. Unlimited, free competitor photo cloning</p>
                </td>
                <td className="px-6 py-6 align-top font-bold text-black text-lg">
                  $0.0145
                </td>
              </tr>

              {/* Mintly */}
              <tr className="bg-white hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-6 align-top">
                  <div className="font-medium text-gray-900">Mintly</div>
                </td>
                <td className="px-6 py-6 align-top text-gray-600 space-y-1 text-sm">
                  <p>1. Clone Competitor Photos</p>
                  <p>2. Product Photo to Ad Video</p>
                  <p>3. Ad Image Generation</p>
                  <p>4. Image Editor</p>
                </td>
                <td className="px-6 py-6 align-top text-gray-600">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Subscription
                  </span>
                </td>
                <td className="px-6 py-6 align-top font-medium text-gray-900">
                  $49
                </td>
                <td className="px-6 py-6 align-top text-gray-600 space-y-1 text-sm">
                  <p>1. Meta Ad Image Cloning</p>
                  <p>2. 300 Ads</p>
                  <p>3. 60 Credits</p>
                  <p>4. 3 Brand Configs</p>
                  <p>5. Image + Video Ads</p>
                </td>
                <td className="px-6 py-6 align-top text-gray-500 font-medium">
                  $0.8166
                </td>
              </tr>

              {/* Arcads */}
              <tr className="bg-white hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-6 align-top">
                  <div className="font-medium text-gray-900">Arcads</div>
                </td>
                <td className="px-6 py-6 align-top text-gray-600 space-y-1 text-sm">
                  <p>1. Character UGC Video Generation</p>
                </td>
                <td className="px-6 py-6 align-top text-gray-600">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Subscription
                  </span>
                </td>
                <td className="px-6 py-6 align-top text-gray-900">
                  $220
                </td>
                <td className="px-6 py-6 align-top text-gray-600 space-y-1 text-sm">
                  <p className="text-gray-600">20 Credits / Month</p>
                </td>
                <td className="px-6 py-6 align-top text-black">
                  $11.00
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-6">
          {/* Flowtra AI Card */}
          <div className="bg-white rounded-xl border border-black/10 shadow-lg p-6 space-y-4 relative overflow-hidden">
             <div className="absolute top-0 right-0 bg-black text-white text-xs font-bold px-3 py-1 rounded-bl-xl">
              BEST VALUE
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-black">Flowtra AI</h3>
                <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-black text-white">
                  One-time: $29
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Per Credit</div>
                <div className="text-xl font-bold text-black">$0.0145</div>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div>
                <h4 className="text-sm font-semibold text-black mb-2">Features</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Character UGC Video Generation</li>
                  <li>• Competitor UGC Video & Photo Cloning</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-black mb-2">Included</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <span className="font-semibold text-black">2000 credits</span></li>
                  <li>• Unlimited, free Veo3.1 Fast generation</li>
                  <li>• 800 mins UGC video download quota</li>
                  <li>• Unlimited, free competitor photo cloning</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Mintly Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-medium text-gray-900">Mintly</h3>
                <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-900/5 text-gray-700">
                  Sub: $49/mo
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Per Credit</div>
                <div className="text-xl font-medium text-gray-600">$0.82</div>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Features</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Clone Competitor Photos</li>
                  <li>• Product Photo to Ad Video</li>
                  <li>• Ad Image Generation</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Included</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 60 Credits</li>
                  <li>• 300 Ads</li>
                  <li>• Meta Ad Image Cloning</li>
                </ul>
              </div>
            </div>
          </div>

           {/* Arcads Card */}
           <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-medium text-gray-900">Arcads</h3>
                <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-900/5 text-gray-700">
                  Sub: $220/mo
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Per Credit</div>
                <div className="text-xl font-medium text-black">$11.00</div>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Features</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Character UGC Video Generation</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-sm text-gray-600 mb-2">Included</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 20 Credits / Month</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}