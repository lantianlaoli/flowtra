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
                <th className="px-6 py-5 w-32">Cost</th>
                <th className="px-6 py-5">Included</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {/* Flowtra AI */}
              <tr className="bg-white hover:bg-[#F7F7F7] transition-colors">
                <td className="px-6 py-8 align-top">
                  <div className="font-bold text-[18px] text-black">Flowtra</div>
                </td>
                <td className="px-6 py-8 align-top font-bold text-black text-[18px]">
                  Basic $59/mo
                </td>
                <td className="px-6 py-8 align-top text-[#666666] space-y-2 text-[14px]">
                  <p>1. <span className="font-bold text-black">3,930 credits</span></p>
                  <p>2. Character UGC & Competitor Replica</p>
                  <p>3. Free Veo3.1 Fast generation</p>
                  <p>4. 26.2 mins UGC video quota</p>
                  <p>5. Unlimited photo cloning</p>
                </td>
              </tr>

              {/* Arcads */}
              <tr className="bg-white hover:bg-[#F7F7F7] transition-colors">
                <td className="px-6 py-8 align-top">
                  <div className="font-semibold text-[16px] text-black">Arcads</div>
                </td>
                <td className="px-6 py-8 align-top font-semibold text-black text-[16px]">
                  Creator $220/mo
                </td>
                <td className="px-6 py-8 align-top text-[#666666] space-y-2 text-[14px]">
                  <p>✓ 20 credits per month</p>
                  <p>✓ 300 Natural AI Actors</p>
                  <p>✓ Use 35 languages</p>
                  <p>✓ Delivered in 2 minutes</p>
                  <p>✓ Play videos up to 120 sec</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-8">
          {/* Flowtra Card */}
          <div className="bg-white rounded-xl border-2 border-black p-8 space-y-6 relative shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
             <div className="absolute top-0 right-0 bg-black text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-widest rounded-bl-xl">
              BEST VALUE
            </div>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[20px] font-bold text-black">Flowtra</h3>
                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black text-white">
                  Basic: $59/mo
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t border-[#E5E5E5]">
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

           {/* Arcads Card */}
           <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-medium text-gray-900">Arcads</h3>
                <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-900/5 text-gray-700">
                  Creator: $220/mo
                </div>
              </div>
            </div>
            
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div>
                <h4 className="text-sm text-gray-600 mb-2">Included</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 20 credits per month</li>
                  <li>• 300 Natural AI Actors</li>
                  <li>• Use 35 languages</li>
                  <li>• Delivered in 2 minutes</li>
                  <li>• Play videos up to 120 sec</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
