'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useUser, SignInButton } from '@clerk/nextjs';
import { GiftIcon } from '@heroicons/react/24/outline';
import { Sparkles, Download } from 'lucide-react';
import { FaTiktok } from 'react-icons/fa6';
import SimpleArrow from '@/components/ui/SimpleArrow';
import VideoPlayer from '@/components/ui/VideoPlayer';
import DemoVideoSchema from '@/components/seo/DemoVideoSchema';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FileUpload from '@/components/FileUpload';
import FAQ from '@/components/sections/FAQ';
import { useRouter } from 'next/navigation';
import { handleCreemCheckout } from '@/lib/payment';

export default function LandingPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useUser();

  const handleFileUpload = () => {
    router.push('/dashboard?upload=true');
  };

  const handlePurchase = async (packageName: 'lite' | 'basic' | 'pro') => {
    await handleCreemCheckout({
      packageName,
      userEmail: user!.emailAddresses[0].emailAddress,
      onLoading: (isLoading) => setLoadingPackage(isLoading ? packageName : null),
      onError: (error) => alert(error)
    });
  };

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Hero Section - Left/Right Layout */}
        <div className="grid lg:grid-cols-5 items-center py-10 sm:py-12 lg:py-16 gap-6 sm:gap-8 lg:gap-12">
          {/* Left Content */}
          <div className="lg:col-span-3 space-y-5 sm:space-y-6 lg:space-y-8">
            {/* Promotion Badge - Above Title */}
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200">
              <GiftIcon className="w-4 h-4" />
              100 Free Credits
              <span className="text-gray-500">Try 3 VEO3 Fast Video</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-tight">
              AI Ads from Your Product Photos
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
              Turn a single image into ready-to-use video ads for Amazon, Walmart, and local stores.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-row items-start gap-3">
              {user ? (
                <button
                  onClick={() => router.push('/dashboard?upload=true')}
                  className="bg-gray-900 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2 flex-1 justify-center"
                >
                  <Sparkles className="w-5 h-5" />
                  <span className="sm:hidden">start</span>
                  <span className="hidden sm:inline">Start Now</span>
                </button>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/dashboard?upload=true">
                  <button
                    className="bg-gray-900 text-white px-6 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2 flex-1 justify-center"
                  >
                    <Sparkles className="w-5 h-5" />
                    <span className="sm:hidden">start</span>
                    <span className="hidden sm:inline">Start Now</span>
                  </button>
                </SignInButton>
              )}
              
              {/* Tutorial Video Button */}
              <a
                href="https://www.youtube.com/watch?v=AvrnifkIx7Q"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-gray-300 text-gray-700 px-6 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-2 flex-1 justify-center"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Tutorial
              </a>
            </div>

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
                <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-[3/4]">
                  <VideoPlayer
                    src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/example.mp4"
                    className="rounded-lg"
                    showControls={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Success Stories Section */}
        <div className="py-12 md:py-20">
          <div className="text-center mb-8 md:mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 sm:mb-6">
              Real Success Stories
            </h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              See how creators and businesses use Flowtra to create engaging video content
            </p>
          </div>

          <div className="space-y-10 md:space-y-16 max-w-6xl mx-auto">
            {/* TikTok Creator Success Story */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 md:p-8">
              {/* User Identity Header + TikTok link aligned */}
              <div className="flex items-center justify-between gap-4 mb-4 md:mb-6">
                <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-200">
                  <Image
                    src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_avatar_1.jpg"
                    alt="@cheerslinkou TikTok creator profile"
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">@cheerslinkou</h3>
                </div>
                </div>
                <a 
                  href="https://www.tiktok.com/@cheerslinkou/video/7543405624797990150"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="View on TikTok"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                >
                  <FaTiktok className="w-3.5 h-3.5" />
                  TikTok
                </a>
              </div>

              {/* User Quote */}
              <div className="mb-4 md:mb-6">
                <blockquote className="text-base sm:text-lg text-gray-700 font-medium leading-relaxed">
                  &ldquo;Flowtra helped me turn my product photo into an engaging TikTok video that perfectly showcases the details and quality.&rdquo;
                </blockquote>
              </div>

              {/* Content Showcase */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-6 lg:gap-10 items-center">
                {/* Original Product Photo */}
                <div className="relative">
                  <div className="aspect-[3/4] bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                    <Image
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_product_1.jpg"
                      alt="Original product photo uploaded by TikTok creator"
                      width={400}
                      height={533}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                
                {/* Arrow */}
                <div className="flex justify-center">
                  <div className="bg-gray-900 rounded-full p-2 sm:p-2.5 lg:p-3 shadow-sm">
                    <SimpleArrow className="w-4 h-4 sm:w-5 sm:h-5 lg:w-5 lg:h-5 text-white" direction="right" />
                  </div>
                </div>
                
                {/* Generated TikTok Video */}
                <div className="relative">
                  <div className="aspect-[3/4] bg-gray-900 rounded-xl border border-gray-200 overflow-hidden">
                    <VideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/user_case_1.mp4"
                      className="rounded-xl"
                      showControls={true}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-10 md:mt-16">
            <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8 font-medium">Ready to transform your products?</p>
            {user ? (
              <button
                onClick={() => router.push('/dashboard?upload=true')}
                className="bg-gray-900 text-white px-10 py-4 rounded-xl font-semibold hover:bg-gray-800 transition-all duration-300 inline-flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                <Sparkles className="w-5 h-5" />
                Start Creating Videos
              </button>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard?upload=true">
                <button className="bg-gray-900 text-white px-10 py-4 rounded-xl font-semibold hover:bg-gray-800 transition-all duration-300 inline-flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                  <Sparkles className="w-5 h-5" />
                  Start Creating Videos
                </button>
              </SignInButton>
            )}
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold mb-4">Start Creating Your Ad</h3>
              <p className="text-gray-600 mb-6">
                Upload your product photo and let AI create amazing advertisements for you. Get started with a free trial!
              </p>
              <FileUpload 
                onFileUpload={handleFileUpload} 
                isLoading={false}
                multiple={false}
              />
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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
                      <td className="text-gray-900 px-4 py-3 border-b border-gray-100 bg-gray-50 border-x border-gray-200 font-semibold">Amazon, Walmart, TikTok, Instagram, Local screens</td>
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
                      <td className="text-gray-900 px-4 py-3 border-b border-gray-100 bg-gray-50 border-x border-gray-200 font-semibold">E-commerce sellers</td>
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
                    <div className="text-gray-900">Amazon, Walmart, TikTok, Instagram, Local screens</div>
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
                    <div className="text-gray-900">E-commerce sellers</div>
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
        <div className="py-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Simple Pricing</h2>
            <p className="text-base text-gray-600">Choose the plan that fits your needs</p>
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
                  <span className="text-gray-600">500 credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">~16 Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">~3 Veo3 High Quality videos</span>
                </li>
              </ul>
              {user ? (
                <button 
                  onClick={() => handlePurchase('lite')}
                  disabled={loadingPackage === 'lite'}
                  className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingPackage === 'lite' ? 'Processing...' : 'Get Started'}
                </button>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                    Get Started
                  </button>
                </SignInButton>
              )}
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
                  <span className="text-gray-600">2,000 credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">~66 Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">~13 Veo3 High Quality videos</span>
                </li>
              </ul>
              {user ? (
                <button 
                  onClick={() => handlePurchase('basic')}
                  disabled={loadingPackage === 'basic'}
                  className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingPackage === 'basic' ? 'Processing...' : 'Get Started'}
                </button>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors">
                    Get Started
                  </button>
                </SignInButton>
              )}
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
                  <span className="text-gray-600">3,500 credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">~116 Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">~23 Veo3 High Quality videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">Priority processing</span>
                </li>
              </ul>
              {user ? (
                <button 
                  onClick={() => handlePurchase('pro')}
                  disabled={loadingPackage === 'pro'}
                  className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingPackage === 'pro' ? 'Processing...' : 'Get Started'}
                </button>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                  <button className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                    Get Started
                  </button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* FAQ Section */}
      <FAQ />

      <Footer />
    </div>
  );
}
