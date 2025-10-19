import Image from 'next/image';
import dynamic from 'next/dynamic';
import { GiftIcon } from '@heroicons/react/24/outline';
import { Download, Smartphone, User, Play, Lightbulb, Check, UserPlus } from 'lucide-react';
import { FaTiktok } from 'react-icons/fa6';
import DemoVideoSchema from '@/components/seo/DemoVideoSchema';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { CREDIT_COSTS } from '@/lib/constants';
import BlogPreview from '@/components/sections/BlogPreview';
import { getActivatedUserCount } from '@/lib/publicMetrics';
import { HeroPrimaryButton } from '@/components/pages/landing/HeroPrimaryButton';
import { PricingButton } from '@/components/pages/landing/PricingButton';
import { StoreLinkCTA } from '@/components/pages/landing/StoreLinkCTA';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';

const FAQ = dynamic(() => import('@/components/sections/FAQ'), {
  loading: () => <div className="py-12 flex justify-center"><div className="text-gray-400">Loading...</div></div>
});

export default async function LandingPage() {

  // Success Stories (no longer needs state management)

  // Success cases data
  const successCases = [
    {
      id: 'standard-ads',
      user: '@cheerslinkou',
      avatar: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_avatar_1.jpg',
      quote: 'Flowtra turned my product photo into a professional ad video that showcases quality perfectly.',
      tiktokUrl: 'https://www.tiktok.com/@cheerslinkou/video/7543405624797990150',
      tiktokText: 'See the Result',
      layout: 'input-to-output',
      content: {
        inputImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_standard_product_1.jpg',
        videoUrl: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_standard_case_1.mp4'
      }
    },
    {
      id: 'character-ads',
      user: '@cheerslinkou',
      avatar: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_avatar_1.jpg',
      quote: 'Amazing! Flowtra combined character with the product to create a personalized video ad that feels authentic and engaging.',
      tiktokUrl: 'https://www.tiktok.com/@cheerslinkou/video/7554347579723517195?lang=en',
      tiktokText: 'See the Magic',
      layout: 'multi-input-to-output',
      content: {
        characterImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_character_human_case_1.png',
        productImage: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_character_product_case_1.jpg',
        videoUrl: 'https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_character_video_case_1.mp4'
      }
    }
  ];

  // Video generation estimates (generation-time billing)
  const liteVideos = Math.floor(500 / CREDIT_COSTS.veo3_fast);
  const basicVideos = Math.floor(2000 / CREDIT_COSTS.veo3_fast);
  const proVideos = Math.floor(3500 / CREDIT_COSTS.veo3_fast);
  const activatedUserCount = await getActivatedUserCount();

  return (
    <div className="min-h-screen bg-white">
      {/* SEO Schema for demo videos */}
      <DemoVideoSchema 
        videoUrl="https://tempfile.aiquickdraw.com/p/bdbf3c847dd219aea0775162c9c77415_1756176082.mp4"
        title="AI Video Ad Generator Demo - Product Photo to Advertisement"
        description="See how Flowtra transforms a simple product photo into professional video advertisements for Amazon, Walmart, and local stores using AI technology"
      />
      <DemoVideoSchema 
        videoUrl="https://tempfile.aiquickdraw.com/p/d51126ac584cea6e6916851b6e6ace9d_1756336008.mp4"
        title="E-commerce Product AI Video Advertisement Example"
        description="Real example of AI-generated video advertisement created from product photo for online retail marketing"
      />
      <DemoVideoSchema 
        videoUrl="https://tempfile.aiquickdraw.com/p/0fcc1f33f4dc11aa3771d75213b53bf6_1756263260.mp4"
        title="Local Store AI Video Ad Creation from Product Image"
        description="Demonstration of AI technology creating professional video advertisements for local stores from a single product photograph"
      />
      
      <Header />

      {/* Hero Section */}
      <main className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Hero Section - Left/Right Layout */}
        <section id="hero" className="grid lg:grid-cols-5 items-center py-10 sm:py-12 lg:py-16 gap-6 sm:gap-8 lg:gap-12 scroll-mt-24">
          {/* Left Content */}
          <div className="lg:col-span-3 space-y-5 sm:space-y-6 lg:space-y-8">
            {/* Removed old badge; benefits moved under subtitle */}

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-tight">
              Professional Ads for <u>Small Business</u>
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
              AI ads for <span className="inline-block bg-[#F56400] text-white px-2 py-1 rounded-md font-semibold">Etsy</span>, <span className="inline-block bg-[#95BF47] text-white px-2 py-1 rounded-md font-semibold">Shopify</span>, <span className="inline-block bg-[#FF90E8] text-white px-2 py-1 rounded-md font-semibold">Gumroad</span>, <span className="inline-block bg-[#6C5CE7] text-white px-2 py-1 rounded-md font-semibold">Stan</span>, social platforms, and local stores.
            </p>

            {/* New users label + key benefits under subtitle */}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {/* Mobile: single concise pill */}
              <span className="inline-flex sm:hidden items-center gap-2 text-sm font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5">
                <GiftIcon className="w-4 h-4" />
                <span>100 free credits (~$1.80 value)</span>
              </span>
              {/* Desktop/Tablet: original two pills */}
              <span className="hidden sm:inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5">
                <UserPlus className="w-4 h-4" />
                <span>For new users</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5">
                <GiftIcon className="w-4 h-4" />
                <span>100 free credits (~$1.80 value)</span>
              </span>
            </div>
            {/* Mobile: compact benefits */}
            <div className="sm:hidden text-gray-700 text-sm mt-2">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Unlimited gen</span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>No watermark</span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Free images</span>
                </span>
              </div>
            </div>
            {/* Desktop/Tablet: detailed benefits */}
            <ul className="hidden sm:flex text-gray-700 text-sm sm:text-base flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 mt-2">
              <li className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 max-w-full">
                <Check className="w-4 h-4 text-green-600" />
                <span className="break-words">
                  Images: <span className="font-semibold underline">unlimited</span> generation + free downloads (
                  <span className="font-semibold underline">no watermark</span>)
                </span>
              </li>
              <li className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 max-w-full">
                <Check className="w-4 h-4 text-green-600" />
                <span className="break-words">
                  Videos: <span className="font-semibold underline">unlimited</span> generation;download each video is worth ~$0.54 (
                  <span className="font-semibold underline">no watermark</span>)
                </span>
              </li>
              <li className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 max-w-full">
                <Check className="w-4 h-4 text-green-600" />
                <span className="break-words"><span className="font-semibold underline">Unlimited</span> product configurations</span>
              </li>
              <li className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 max-w-full">
                <Check className="w-4 h-4 text-green-600" />
                <span className="break-words">Portraits: <span className="font-semibold underline">unlimited</span> character additions</span>
              </li>
            </ul>

            {/* CTA Buttons */}
            <div className="flex flex-row items-start gap-3">
              <HeroPrimaryButton />
              {/* Tutorial Video Button */}
              <a
                href="https://youtu.be/zCFmbZJaUws"
                target="_blank"
                rel="noopener noreferrer"
                className="silk-button relative h-14 px-6 rounded-lg text-lg font-semibold flex items-center gap-2 flex-1 justify-center cursor-pointer"
                title="See how easy it is"
              >
                <span className="sm:hidden">Watch</span>
                <span className="hidden sm:inline silk-content">
                  <span className="silk-default">
                    <Play className="w-5 h-5" />
                    <span>See How Easy</span>
                  </span>
                  <span className="silk-hover">
                    <Lightbulb className="w-5 h-5" />
                    <span>Watch tutorial</span>
                  </span>
                </span>
              </a>
            </div>

            {/* Social Proof under CTA - only show with real metric */}
            {activatedUserCount > 0 && (
              <div className="pt-3" aria-label="Social proof">
                <div
                  className="inline-flex min-w-[240px] items-center gap-3 rounded-2xl px-4 py-2
                             bg-black/5 dark:bg-white/5 ring-1 ring-inset ring-black/10 dark:ring-white/10
                             transition-colors hover:ring-black/20 dark:hover:ring-white/20"
                >
                  {/* Avatars group */}
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="inline-block w-7 h-7 rounded-full ring-2 ring-white/80 dark:ring-zinc-900/80 overflow-hidden">
                        <Image
                          src={`https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_avatar_${i}.${i === 1 ? 'jpg' : 'png'}`}
                          alt={`User avatar ${i}`}
                          width={28}
                          height={28}
                          sizes="28px"
                          className="w-full h-full object-cover"
                         
                        />
                      </div>
                    ))}
                  </div>
                  {/* Single-line copy for harmony with avatars */}
                  <span
                    className="text-sm font-semibold text-black whitespace-nowrap"
                    title={`${activatedUserCount.toLocaleString('en-US')} small business owners trust Flowtra`}
                  >
                    {`Trusted by `}
                    <span className="font-bold tabular-nums">
                      {activatedUserCount.toLocaleString('en-US')}
                    </span>
                    {` small business owners`}
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* Right Demo - Multi-Output Layout */}
          <div className="lg:col-span-2 space-y-5 sm:space-y-6 flex flex-col justify-center">
            {/* Original Image - Top */}
            <div className="relative w-48 mx-auto">
              <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-[3/4]">
                <Image
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/example.png"
                  alt="AI video advertisement generator showing product photo transformation for Amazon and Walmart ads"
                  width={300}
                  height={400}
                  sizes="(max-width: 640px) 192px, (max-width: 768px) 192px, 192px"
                  priority
                  className="w-full h-full object-cover"
                 
                />
              </div>
            </div>

            {/* Simple Arrow */}
            <div className="flex justify-center py-2">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>

            {/* Dual Output - Bottom */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 max-w-md mx-auto">
              {/* Free Cover - Left */}
              <div className="relative">
                <div className="bg-gray-50 rounded-lg overflow-hidden border-2 border-green-200 shadow-sm aspect-[3/4] hover:border-green-300 transition-colors">
                  <Image
                    src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/example_cover.png"
                    alt="AI-generated product cover design - free download"
                    width={300}
                    height={400}
                    sizes="(max-width: 640px) 145px, (max-width: 768px) 181px, 248px"
                    className="w-full h-full object-cover"
                   
                  />
                </div>
                <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  FREE
                </div>
              </div>

              {/* Premium Video - Right */}
              <div className="relative">
                <LazyVideoPlayer
                  wrapperClassName="bg-gray-900 rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-[3/4]"
                  className="w-full h-full rounded-lg object-contain"
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/example.mp4"
                  ariaLabel="AI-generated video advertisement example showing product transformation"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Removed CTA below Hero per request */}

        {/* Features / Success Stories Section */}
        <section id="features" className="pt-12 md:pt-20 pb-6 md:pb-10 scroll-mt-24">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 sm:mb-6">
              Real Success Stories
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              See how creators and businesses use Flowtra to create engaging video content
            </p>
          </div>

          {/* Side-by-Side TikTok Style Cards */}
          <div className="max-w-[100rem] mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-6 lg:gap-8">

              {/* Standard Ads Case */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-6 md:p-8 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                      <Image
                        src={successCases[0].avatar}
                        alt={`${successCases[0].user} TikTok creator profile`}
                        width={48}
                        height={48}
                        sizes="48px"
                        className="w-full h-full object-cover"
                       
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{successCases[0].user}</h3>
                      <div className="flex items-center gap-1.5 text-blue-600">
                        <Smartphone className="w-4 h-4" />
                        <span className="text-sm font-medium">Standard Ads</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={successCases[0].tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${successCases[0].tiktokText} on TikTok`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-pointer"
                  >
                    <FaTiktok className="w-4 h-4" />
                    <span className="sm:hidden">View</span>
                    <span className="hidden sm:inline">{successCases[0].tiktokText}</span>
                  </a>
                </div>

                {/* Quote */}
                <div className="mb-6">
                  <blockquote className="text-lg text-gray-700 font-medium leading-relaxed max-w-md mx-auto" style={{lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                    &ldquo;{successCases[0].quote}&rdquo;
                  </blockquote>
                </div>

                {/* Before & After Showcase */}
                {successCases[0].layout === 'input-to-output' ? (
                  <div className="relative max-w-2xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
                      {/* Original Product Image */}
                      <div className="flex flex-col items-center">
                        <div className="aspect-[3/4] bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-lg w-[160px] h-[213px] sm:w-[200px] sm:h-[267px]">
                          <Image
                            src={successCases[0].content.inputImage!}
                            alt="Original product photo"
                            width={200}
                            height={267}
                            sizes="200px"
                            className="w-full h-full object-cover"
                           
                          />
                        </div>
                      </div>

                      {/* Mobile Arrow Between (vertical) */}
                      <div className="block sm:hidden my-1">
                        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Generated Video */}
                      <div className="flex flex-col items-center">
                        <LazyVideoPlayer
                          wrapperClassName="aspect-[3/4] bg-gray-900 rounded-2xl border border-gray-200 overflow-hidden shadow-xl w-[160px] h-[213px] sm:w-[200px] sm:h-[267px]"
                          className="h-full w-full rounded-2xl"
                          src={successCases[0].content.videoUrl}
                          ariaLabel="Standard Ads success story: video created with Flowtra AI"
                        />
                      </div>
                    </div>

                    {/* Arrow Indicator */}
                    <div className="hidden sm:block absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 -mt-4">
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                        <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative mx-auto max-w-[240px]">
                    <LazyVideoPlayer
                      wrapperClassName="aspect-[3/4] bg-gray-900 rounded-2xl border border-gray-200 overflow-hidden shadow-xl"
                      className="h-full w-full rounded-2xl"
                      src={successCases[0].content.videoUrl}
                      showControls={true}
                      ariaLabel="Standard Ads success story: video created with Flowtra AI"
                    />
                  </div>
                )}
              </div>

              {/* Character Ads Case */}
              <div className="bg-white rounded-3xl border border-gray-200 shadow-lg p-6 md:p-8 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                      <Image
                        src={successCases[1].avatar}
                        alt={`${successCases[1].user} TikTok creator profile`}
                        width={48}
                        height={48}
                        sizes="48px"
                        className="w-full h-full object-cover"
                       
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{successCases[1].user}</h3>
                      <div className="flex items-center gap-1.5 text-purple-600">
                        <User className="w-4 h-4" />
                        <span className="text-sm font-medium">Character Ads</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={successCases[1].tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${successCases[1].tiktokText} on TikTok`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-pointer"
                  >
                    <FaTiktok className="w-4 h-4" />
                    <span className="sm:hidden">View</span>
                    <span className="hidden sm:inline">{successCases[1].tiktokText}</span>
                  </a>
                </div>

                {/* Quote */}
                <div className="mb-6">
                  <blockquote className="text-lg text-gray-700 font-medium leading-relaxed">
                    &ldquo;{successCases[1].quote}&rdquo;
                  </blockquote>
                </div>

                {/* Multi-Input Showcase - Updated */}
                {successCases[1].layout === 'multi-input-to-output' ? (
                  <div className="w-full mx-auto max-w-7xl">
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
                      {/* Character Image */}
                      <div className="flex flex-col items-center">
                        <div className="aspect-[3/4] bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-lg w-[140px] h-[187px] sm:w-[200px] sm:h-[267px]">
                          <Image
                            src={successCases[1].content.characterImage!}
                            alt="Character photo"
                            width={200}
                            height={267}
                            sizes="200px"
                            className="w-full h-full object-cover"
                           
                          />
                        </div>
                      </div>

                      {/* Plus Sign */}
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                      </div>

                      {/* Product Image */}
                      <div className="flex flex-col items-center">
                        <div className="aspect-[3/4] bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-lg w-[140px] h-[187px] sm:w-[200px] sm:h-[267px]">
                          <Image
                            src={successCases[1].content.productImage!}
                            alt="Product photo"
                            width={200}
                            height={267}
                            sizes="200px"
                            className="w-full h-full object-cover"
                           
                          />
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>

                      {/* Generated Video */}
                      <div className="flex flex-col items-center">
                        <LazyVideoPlayer
                          wrapperClassName="aspect-[3/4] bg-gray-900 rounded-2xl border border-gray-200 overflow-hidden shadow-xl w-[140px] h-[187px] sm:w-[200px] sm:h-[267px]"
                          className="h-full w-full rounded-2xl"
                          src={successCases[1].content.videoUrl}
                          ariaLabel="Character Ads success story: personalized video created with character and product"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative mx-auto max-w-[240px]">
                    <LazyVideoPlayer
                      wrapperClassName="aspect-[3/4] bg-gray-900 rounded-2xl border border-gray-200 overflow-hidden shadow-xl"
                      className="h-full w-full rounded-2xl"
                      src={successCases[1].content.videoUrl}
                      showControls={true}
                      ariaLabel="Character Ads success story: personalized video created with character and product"
                    />
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Lead Capture: Store Link Submission */}
          <StoreLinkCTA />
        </section>
        {/* Competitor Comparison Section */}
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
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Flowtra</h3>
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-900 text-white">Best Choice</span>
                </div>
                <div className="text-sm border border-gray-100 rounded-md overflow-hidden">
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                    <div className="text-gray-500">Core Focus</div>
                    <div className="text-gray-900 font-medium">AI ads for retail</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                    <div className="text-gray-500">Ease of Use</div>
                    <div className="text-gray-900 font-medium">Photo → Ad instantly</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                    <div className="text-gray-500">Cost</div>
                    <div className="text-gray-900">FREE photos • Pay when satisfied • &lt;$1 per ad</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                    <div className="text-gray-500">Platforms</div>
                    <div className="text-gray-900">Amazon, Walmart, Gumroad, Stan, Payhip, TikTok, Instagram, Local screens</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                    <div className="text-gray-500">Learning</div>
                    <div className="text-gray-900">Minutes</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                    <div className="text-gray-500">Maintenance</div>
                    <div className="text-gray-900">No pipelines to maintain</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                    <div className="text-gray-500">Timeline</div>
                    <div className="text-gray-900">Seconds</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                    <div className="text-gray-500">Best For</div>
                    <div className="text-gray-900">E-commerce sellers & digital creators</div>
                  </div>
                </div>
              </div>

              {/* n8n Card */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 sm:p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">n8n Workflow</h3>
                </div>
                <div className="text-sm border border-gray-100 rounded-md overflow-hidden">
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                    <div className="text-gray-500">Core Focus</div>
                    <div className="text-gray-900">Manual AI setup</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                    <div className="text-gray-500">Ease of Use</div>
                    <div className="text-gray-900">Needs dev skills</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                    <div className="text-gray-500">Cost</div>
                    <div className="text-gray-900">$20+/month + API costs</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                    <div className="text-gray-500">Integrations</div>
                    <div className="text-gray-900">Requires custom integrations</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                    <div className="text-gray-500">Learning</div>
                    <div className="text-gray-900">Hours–days</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                    <div className="text-gray-500">Maintenance</div>
                    <div className="text-gray-900">Maintain flows, tokens, failures</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-white">
                    <div className="text-gray-500">Timeline</div>
                    <div className="text-gray-900">Hours–days</div>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] items-start gap-2 px-3 py-2.5 bg-gray-50">
                    <div className="text-gray-500">Best For</div>
                    <div className="text-gray-900">Dev teams</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <section id="pricing" className="py-12 scroll-mt-24">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Pay Once, Use Forever</h2>
            <p className="text-base text-gray-600">One-time purchase. No subscriptions. Flexible billing: Basic models (free generation, paid download) or Premium models (paid generation, free download)</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
            {/* Lite Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm hover:border-gray-300 transition-colors flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Lite</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $9
                <span className="text-lg font-normal text-gray-600">/package</span>
              </div>
              <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600"><span className="font-bold text-gray-900">500</span> credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">≈ <span className="font-bold text-gray-900">{liteVideos}</span> Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Mixed billing model</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Always free image generation</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Standard Ads, Multi-Variant Ads</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Character Ads</span>
                </li>
              </ul>
              <PricingButton packageName="lite" />
            </div>

            {/* Basic Plan (Recommended) */}
            <div className="bg-white rounded-2xl border-2 border-gray-900 p-6 md:p-8 shadow-sm transform scale-105 flex flex-col">
              <div className="bg-gray-900 text-white px-3 py-1 rounded-md text-sm font-medium mb-4 inline-block">
                Recommended
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Basic</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $29
                <span className="text-lg font-normal text-gray-600">/package</span>
              </div>
              <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600"><span className="font-bold text-gray-900">2,000</span> credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">≈ <span className="font-bold text-gray-900">{basicVideos}</span> Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">Free unlimited downloads</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">Free image generation</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">Standard Ads, Multi-Variant Ads</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">Character Ads</span>
                </li>
              </ul>
              <PricingButton packageName="basic" />
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 shadow-sm hover:border-gray-300 transition-colors flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Pro</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $49
                <span className="text-lg font-normal text-gray-600">/package</span>
              </div>
              <ul className="space-y-2.5 mb-6 md:mb-8 flex-grow">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600"><span className="font-bold text-gray-900">3,500</span> credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">≈ <span className="font-bold text-gray-900">{proVideos}</span> Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Mixed billing model</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Always free image generation</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Standard Ads, Multi-Variant Ads</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Character Ads</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Priority processing</span>
                </li>
              </ul>
              <PricingButton packageName="pro" />
            </div>
          </div>
        </section>

        {/* Removed extra CTA below Pricing per request (keep single combined CTA in cases) */}
      </main>

      {/* Blog Preview Section */}
      <BlogPreview />

      {/* FAQ Section */}
      <FAQ />

      <Footer />
    </div>
  );
}
