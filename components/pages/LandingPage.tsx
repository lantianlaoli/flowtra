'use client';

import { useState, useRef } from 'react';
import { useUser, SignInButton } from '@clerk/nextjs';
import { GiftIcon } from '@heroicons/react/24/outline';
import { Sparkles } from 'lucide-react';
import HandDrawnArrow from '@/components/ui/HandDrawnArrow';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FileUpload from '@/components/FileUpload';
import { useRouter } from 'next/navigation';
import { handleCreemCheckout } from '@/lib/payment';

export default function LandingPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  const handleVideoHover = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
    }
  };

  const handleVideoLeave = () => {
    if (videoRef.current) {
      videoRef.current.muted = true;
    }
  };

  return (
    <div className="min-h-screen bg-white">
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
              Ad Videos for Amazon & Walmart
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
              Upload your product photo. Get a sales-ready ad in seconds.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <button
                onClick={() => setShowUpload(true)}
                className="bg-gray-900 text-white px-10 py-5 rounded-lg text-xl font-semibold hover:bg-gray-800 transition-colors flex items-center gap-3 min-w-[280px] justify-center"
              >
                <Sparkles className="w-6 h-6" />
                Get My Video Ad
              </button>
            </div>

          </div>

          {/* Right Demo - Vertical Layout */}
          <div className="lg:col-span-2 space-y-4">
            {/* Original Image - Top */}
            <div className="relative">
              <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 shadow-sm aspect-video">
                <img 
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/covers/bogl45guwpk.jpg"
                  alt="Original product image"
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
                <video 
                  ref={videoRef}
                  className="w-full h-full object-cover cursor-pointer"
                  autoPlay 
                  muted 
                  loop 
                  playsInline
                  onMouseEnter={handleVideoHover}
                  onMouseLeave={handleVideoLeave}
                >
                  <source 
                    src="https://tempfile.aiquickdraw.com/p/bdbf3c847dd219aea0775162c9c77415_1756176082.mp4" 
                    type="video/mp4" 
                  />
                </video>
              </div>
              <div className="absolute top-3 left-3 bg-gray-900 text-white px-3 py-1 rounded-md text-xs font-medium shadow-sm">
                AI Generated
              </div>
              <div className="absolute bottom-3 right-3 bg-black/50 text-white px-2 py-1 rounded text-xs">
                Hover for sound
              </div>
            </div>
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

      <Footer />
    </div>
  );
}