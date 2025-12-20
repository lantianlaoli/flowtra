export default function ComparisonSection() {
  return (
    <section className="py-20 lg:py-24 bg-white">
      <div className="text-center mb-16 px-4">
        <h2 className="text-[32px] md:text-[40px] font-bold text-black mb-4 tracking-tight">Arcads Alternative</h2>
        <p className="text-lg text-[#666666]">Discover a superior alternative for your video generation needs</p>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto rounded-xl border border-[#E5E5E5] shadow-[0_20px_40px_rgba(0,0,0,0.05)]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F7F7] border-b border-[#E5E5E5] text-[12px] font-bold text-black uppercase tracking-wider">
                <th className="px-6 py-5 w-48">Platform</th>
                <th className="px-6 py-5 w-64">Features</th>
                <th className="px-6 py-5 w-32">Billing</th>
                <th className="px-6 py-5 w-32">Cost</th>
                <th className="px-6 py-5">Included</th>
                <th className="px-6 py-5 w-40">Cost / Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {/* Flowtra AI */}
              <tr className="bg-white hover:bg-[#F7F7F7] transition-colors">
                <td className="px-6 py-8 align-top">
                  <div className="font-bold text-[18px] text-black">Flowtra AI</div>
                </td>
                <td className="px-6 py-8 align-top text-[#666666] space-y-2 text-[14px]">
                  <p>1. Character UGC Video Generation</p>
                  <p>2. Competitor UGC Video & Photo Cloning</p>
                </td>
                <td className="px-6 py-8 align-top">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black text-white">
                    One-time
                  </span>
                </td>
                <td className="px-6 py-8 align-top font-bold text-black text-[20px]">
                  $59
                </td>
                <td className="px-6 py-8 align-top text-[#666666] space-y-2 text-[14px]">
                  <p>1. <span className="font-bold text-black">3,930 credits</span></p>
                  <p>2. Character UGC & Competitor Replica</p>
                  <p>3. Free Veo3.1 Fast generation</p>
                  <p>4. 26.2 mins UGC video quota</p>
                  <p>5. Unlimited photo cloning</p>
                </td>
                <td className="px-6 py-8 align-top font-bold text-black text-[20px]">
                  $0.015
                </td>
              </tr>

              {/* Mintly */}
              <tr className="bg-white hover:bg-[#F7F7F7] transition-colors">
                <td className="px-6 py-8 align-top">
                  <div className="font-semibold text-[16px] text-black">Mintly</div>
                </td>
                <td className="px-6 py-8 align-top text-[#666666] space-y-2 text-[14px]">
                  <p>1. Clone Competitor Photos</p>
                  <p>2. Product Photo to Ad Video</p>
                  <p>3. Ad Image Generation</p>
                </td>
                <td className="px-6 py-8 align-top text-[#666666] text-[14px]">
                  Subscription
                </td>
                <td className="px-6 py-8 align-top font-semibold text-black text-[16px]">
                  $49
                </td>
                <td className="px-6 py-8 align-top text-[#666666] space-y-2 text-[14px]">
                  <p>1. Meta Ad Image Cloning</p>
                  <p>2. 300 Ads</p>
                  <p>3. 60 Credits</p>
                </td>
                <td className="px-6 py-8 align-top text-[#666666] text-[16px]">
                  $0.81
                </td>
              </tr>

              {/* Arcads */}
              <tr className="bg-white hover:bg-[#F7F7F7] transition-colors">
                <td className="px-6 py-8 align-top">
                  <div className="font-semibold text-[16px] text-black">Arcads</div>
                </td>
                <td className="px-6 py-8 align-top text-[#666666] space-y-2 text-[14px]">
                  <p>1. Character UGC Generation</p>
                </td>
                <td className="px-6 py-8 align-top text-[#666666] text-[14px]">
                  Subscription
                </td>
                <td className="px-6 py-8 align-top font-semibold text-black text-[16px]">
                  $220
                </td>
                <td className="px-6 py-8 align-top text-[#666666] space-y-2 text-[14px]">
                  <p>20 Credits / Month</p>
                </td>
                <td className="px-6 py-8 align-top text-[#666666] text-[16px]">
                  $11.00
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-8">
          {/* Flowtra AI Card */}
          <div className="bg-white rounded-xl border-2 border-black p-8 space-y-6 relative shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
             <div className="absolute top-0 right-0 bg-black text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-widest rounded-bl-xl">
              BEST VALUE
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[20px] font-bold text-black">Flowtra AI</h3>
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black text-white">
                  One-time: $59
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#666666]">Per Credit</div>
                <div className="text-[24px] font-bold text-black">$0.015</div>
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t border-[#E5E5E5]">
              <div>
                <h4 className="text-[12px] font-bold text-black uppercase tracking-wider mb-3">Features</h4>
                <ul className="text-[14px] text-[#666666] space-y-2">
                  <li>• Character UGC Video Generation</li>
                  <li>• Competitor UGC Cloning</li>
                </ul>
              </div>

              <div>
                <h4 className="text-[12px] font-bold text-black uppercase tracking-wider mb-3">Included</h4>
                <ul className="text-[14px] text-[#666666] space-y-2">
                  <li>• <span className="font-bold text-black">3,930 credits</span></li>
                  <li>• Free Veo3.1 Fast generation</li>
                  <li>• 26.2 mins video quota</li>
                  <li>• Unlimited photo cloning</li>
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