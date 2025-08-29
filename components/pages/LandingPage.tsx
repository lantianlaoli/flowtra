'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useUser, SignInButton } from '@clerk/nextjs';
import { GiftIcon } from '@heroicons/react/24/outline';
import { Sparkles, Check, X } from 'lucide-react';
import HandDrawnArrow from '@/components/ui/HandDrawnArrow';
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

  const handlePurchase = async (packageName: 'starter' | 'pro') => {
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
        <div className="grid lg:grid-cols-5 gap-12 items-center py-16">
          {/* Left Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Promotion Badge - Above Title */}
            <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200">
              <GiftIcon className="w-4 h-4" />
              30 Free Credits
              <span className="text-gray-500">Try 1 VEO3 Fast Video</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-tight">
              AI Ads from Your Product Photos
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
              Turn a single image into ready-to-use video ads for Amazon, Walmart, and local stores.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-start gap-4">
              {user ? (
                <button
                  onClick={() => router.push('/dashboard?upload=true')}
                  className="bg-gray-900 text-white px-10 py-5 rounded-lg text-xl font-semibold hover:bg-gray-800 transition-colors flex items-center gap-3 min-w-[280px] justify-center"
                >
                  <Sparkles className="w-6 h-6" />
                  Get My Video Ad
                </button>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/dashboard?upload=true">
                  <button
                    className="bg-gray-900 text-white px-10 py-5 rounded-lg text-xl font-semibold hover:bg-gray-800 transition-colors flex items-center gap-3 min-w-[280px] justify-center"
                  >
                    <Sparkles className="w-6 h-6" />
                    Get My Video Ad
                  </button>
                </SignInButton>
              )}
            </div>

          </div>

          {/* Right Demo - Vertical Layout */}
          <div className="lg:col-span-2 space-y-4">
            {/* Original Image - Top */}
            <div className="relative">
              <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-video">
                <Image 
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/covers/bogl45guwpk.jpg"
                  alt="AI video advertisement generator showing product photo transformation for Amazon and Walmart ads"
                  width={800}
                  height={450}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute top-3 left-3 bg-white text-gray-700 px-3 py-1 rounded-md text-xs font-medium border border-gray-200 shadow-sm">
                Original
              </div>
            </div>

            {/* Hand Drawn Arrow */}
            <HandDrawnArrow className="w-5 h-5" />

            {/* Generated Video - Bottom */}
            <div className="relative">
              <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-video">
                <VideoPlayer
                  src="https://tempfile.aiquickdraw.com/p/bdbf3c847dd219aea0775162c9c77415_1756176082.mp4"
                  className="rounded-lg"
                  showControls={true}
                />
              </div>
              <div className="absolute top-3 left-3 bg-gray-900 text-white px-3 py-1 rounded-md text-xs font-medium shadow-sm">
                AI Generated
              </div>
            </div>
          </div>
        </div>

        {/* Examples Section - Horizontal Layout */}
        <div className="py-24">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              AI-Generated Product Advertisement Examples
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              See how our AI transforms ordinary product photos into compelling video advertisements for Amazon, Walmart, and local stores
            </p>
          </div>

          <div className="space-y-16 max-w-6xl mx-auto">
            {/* Example 1 - Horizontal Layout */}
            <div className="group bg-gray-50 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all duration-300 p-10">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-16 items-center">
                {/* Before Image */}
                <div className="relative">
                  <div className="aspect-video bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <Image
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/covers/yikk0aysjf.jpg"
                      alt="Original e-commerce product photo before AI video ad generation"
                      width={600}
                      height={338}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-3 left-3 bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded-md text-xs font-medium">
                    Original
                  </div>
                </div>
                
                {/* Arrow */}
                <div className="flex justify-center lg:flex-col">
                  <div className="bg-gray-200 rounded-full p-3 group-hover:bg-gray-300 transition-colors duration-200">
                    <SimpleArrow className="w-6 h-6 text-gray-600 lg:w-5 lg:h-5" direction="right" />
                  </div>
                  <div className="bg-gray-200 rounded-full p-3 lg:hidden group-hover:bg-gray-300 transition-colors duration-200">
                    <SimpleArrow className="w-6 h-6 text-gray-600" direction="down" />
                  </div>
                </div>
                
                {/* After Video */}
                <div className="relative">
                  <div className="aspect-video bg-gray-900 rounded-lg border border-gray-200 overflow-hidden">
                    <VideoPlayer
                      src="https://tempfile.aiquickdraw.com/p/d51126ac584cea6e6916851b6e6ace9d_1756336008.mp4"
                      className="rounded-lg"
                      showControls={true}
                    />
                  </div>
                  <div className="absolute top-3 right-3 bg-gray-900 text-white px-3 py-1 rounded-md text-xs font-medium">
                    AI Generated
                  </div>
                </div>
              </div>
            </div>

            {/* Example 2 - Horizontal Layout */}
            <div className="group bg-gray-50 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all duration-300 p-10">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-16 items-center">
                {/* Before Image */}
                <div className="relative">
                  <div className="aspect-video bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <Image
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/covers/ayu1e4eo7n9.jpg"
                      alt="Local store product photo ready for AI advertisement creation"
                      width={600}
                      height={338}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute top-3 left-3 bg-white border border-gray-200 text-gray-700 px-3 py-1 rounded-md text-xs font-medium">
                    Original
                  </div>
                </div>
                
                {/* Arrow */}
                <div className="flex justify-center lg:flex-col">
                  <div className="bg-gray-200 rounded-full p-3 group-hover:bg-gray-300 transition-colors duration-200">
                    <SimpleArrow className="w-6 h-6 text-gray-600 lg:w-5 lg:h-5" direction="right" />
                  </div>
                  <div className="bg-gray-200 rounded-full p-3 lg:hidden group-hover:bg-gray-300 transition-colors duration-200">
                    <SimpleArrow className="w-6 h-6 text-gray-600" direction="down" />
                  </div>
                </div>
                
                {/* After Video */}
                <div className="relative">
                  <div className="aspect-video bg-gray-900 rounded-lg border border-gray-200 overflow-hidden">
                    <VideoPlayer
                      src="https://tempfile.aiquickdraw.com/p/0fcc1f33f4dc11aa3771d75213b53bf6_1756263260.mp4"
                      className="rounded-lg"
                      showControls={true}
                    />
                  </div>
                  <div className="absolute top-3 right-3 bg-gray-900 text-white px-3 py-1 rounded-md text-xs font-medium">
                    AI Generated
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16">
            <p className="text-lg text-gray-600 mb-8 font-medium">Ready to transform your products?</p>
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
        <div className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Flowtra?</h2>
            <p className="text-lg text-gray-600">See how we compare to other solutions in the market</p>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-4 px-6 font-semibold text-gray-900 w-1/6">Feature</th>
                    <th className="text-center py-4 px-6 font-bold text-white bg-gray-900 w-1/6">Flowtra</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-700 w-1/6">Traditional Advertising</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-700 w-1/6">n8n (Workflow Automation)</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-700 w-1/6">Runway</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-700 w-1/6">Synthesia</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6 font-medium text-gray-900">Core Focus</td>
                    <td className="py-4 px-6 text-center bg-gray-50 font-semibold text-gray-900">AI-generated ads for ecommerce & retail</td>
                    <td className="py-4 px-6 text-center text-gray-600">Manual video production with crew, equipment & studios</td>
                    <td className="py-4 px-6 text-center text-gray-600">General automation platform, requires manual AI integration</td>
                    <td className="py-4 px-6 text-center text-gray-600">Creative AI video editing, effects & generative video</td>
                    <td className="py-4 px-6 text-center text-gray-600">AI avatars & corporate training videos</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6 font-medium text-gray-900">Ease of Use</td>
                    <td className="py-4 px-6 text-center bg-gray-50 font-semibold text-gray-900">Plug-and-play, no coding required</td>
                    <td className="py-4 px-6 text-center text-gray-600">Very High — requires project management & multiple vendors</td>
                    <td className="py-4 px-6 text-center text-gray-600">High — needs developers & API knowledge</td>
                    <td className="py-4 px-6 text-center text-gray-600">Medium — designed for creators, but not ad-focused</td>
                    <td className="py-4 px-6 text-center text-gray-600">Easy — template-based, but limited for ads</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6 font-medium text-gray-900">Pricing Model</td>
                    <td className="py-4 px-6 text-center bg-gray-50 font-semibold text-gray-900">Pay-as-you-go credits (from $29)</td>
                    <td className="py-4 px-6 text-center text-gray-600">Project-based: $5,000-$50,000+ per video</td>
                    <td className="py-4 px-6 text-center text-gray-600">Free open-source, but hidden costs for APIs/GPUs</td>
                    <td className="py-4 px-6 text-center text-gray-600">Subscription ($12–$76/mo, limited minutes)</td>
                    <td className="py-4 px-6 text-center text-gray-600">Subscription ($30–$500+/mo, per seat & per minute)</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6 font-medium text-gray-900">Example Package</td>
                    <td className="py-4 px-6 text-center bg-gray-50 text-sm">
                      <div className="font-semibold text-gray-900 mb-1">Starter $29 → 2,000 credits ≈ 65 ads</div>
                      <div className="font-semibold text-gray-900">Pro $99 → 7,500 credits ≈ 250 ads</div>
                    </td>
                    <td className="py-4 px-6 text-center text-gray-600">Single 30s ad: $15,000+ (2-4 weeks production time)</td>
                    <td className="py-4 px-6 text-center text-gray-600">No packages; must buy external compute & APIs</td>
                    <td className="py-4 px-6 text-center text-gray-600">Standard plan: 625 video credits (minutes) for $35/mo</td>
                    <td className="py-4 px-6 text-center text-gray-600">Starter $30/mo = 10 minutes of video</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6 font-medium text-gray-900">Video Model Consumption</td>
                    <td className="py-4 px-6 text-center bg-gray-50 text-sm">
                      <div className="font-semibold text-gray-900 mb-1">Veo3 Fast: 30 credits/ad</div>
                      <div className="font-semibold text-gray-900">Veo3 HQ: 150 credits/ad</div>
                    </td>
                    <td className="py-4 px-6 text-center text-gray-600">Human resources: crew, equipment, studio rental per day</td>
                    <td className="py-4 px-6 text-center text-gray-600">Depends on external models (OpenAI, Stability, etc.)</td>
                    <td className="py-4 px-6 text-center text-gray-600">Credit system based on seconds of video</td>
                    <td className="py-4 px-6 text-center text-gray-600">Charged per minute of video generated</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-4 px-6 font-medium text-gray-900">Ad Customization</td>
                    <td className="py-4 px-6 text-center bg-gray-50">
                      <span className="inline-flex items-center gap-2 text-green-600 font-semibold">
                        <Check className="w-5 h-5" />
                        Pre-built ad templates for online stores & local shops
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-2 text-orange-500">
                        <Check className="w-5 h-5" />
                        Full customization but requires extensive planning & budget
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-2 text-red-500">
                        <X className="w-5 h-5" />
                        Requires manual workflow design
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-2 text-red-500">
                        <X className="w-5 h-5" />
                        Strong for effects, weak for retail ads
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center gap-2 text-red-500">
                        <X className="w-5 h-5" />
                        Strong for avatars, weak for ecommerce ads
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-4 px-6 font-medium text-gray-900">Best For</td>
                    <td className="py-4 px-6 text-center bg-gray-50 font-semibold text-gray-900">Ecommerce sellers, retail shops, cross-border merchants</td>
                    <td className="py-4 px-6 text-center text-gray-600">Large brands with big budgets & long lead times</td>
                    <td className="py-4 px-6 text-center text-gray-600">Developers & technical teams</td>
                    <td className="py-4 px-6 text-center text-gray-600">Video creators, editors, agencies</td>
                    <td className="py-4 px-6 text-center text-gray-600">Enterprises, training, corporate comms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pricing Section */}
        <div className="py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple Pricing</h2>
            <p className="text-lg text-gray-600">Choose the plan that fits your needs</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-white rounded-2xl border-2 border-gray-900 p-8 shadow-sm transform scale-105 flex flex-col">
              <div className="bg-gray-900 text-white px-3 py-1 rounded-md text-sm font-medium mb-4 inline-block">
                Recommended
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Starter</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $29
                <span className="text-lg font-normal text-gray-600">/package</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">2,000 credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">~65 Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
                  <span className="text-gray-600">~13 Veo3 High Quality videos</span>
                </li>
              </ul>
              {user ? (
                <button 
                  onClick={() => handlePurchase('starter')}
                  disabled={loadingPackage === 'starter'}
                  className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingPackage === 'starter' ? 'Processing...' : 'Get Started'}
                </button>
              ) : (
                <SignInButton mode="modal">
                  <button className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors">
                    Get Started
                  </button>
                </SignInButton>
              )}
            </div>

            {/* Pro Plan */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:border-gray-300 transition-colors flex flex-col">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Pro</h3>
              <div className="text-3xl font-bold text-gray-900 mb-4">
                $99
                <span className="text-lg font-normal text-gray-600">/package</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">7,500 credits</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">~250 Veo3 Fast videos</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                  <span className="text-gray-600">~50 Veo3 High Quality videos</span>
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
                <SignInButton mode="modal">
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