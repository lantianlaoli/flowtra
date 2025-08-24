'use client';

import { useState } from 'react';
import { SignedIn, SignedOut } from '@clerk/nextjs';
import { ArrowUpTrayIcon, ArrowRightIcon, PlayIcon } from '@heroicons/react/24/outline';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import FileUpload from '@/components/FileUpload';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const [showUpload, setShowUpload] = useState(false);
  const router = useRouter();

  const handleFileUpload = (file: File) => {
    router.push('/dashboard?upload=true');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Promotion Badge */}
        <div className="flex justify-center pt-8 mb-8">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-full text-sm font-medium flex items-center gap-2">
            🎁 FREE Start
            <span className="text-gray-300">Create Your First AI Video Ad</span>
          </div>
        </div>

        {/* Main Hero Section - Left/Right Layout */}
        <div className="grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left Content */}
          <div className="space-y-8">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 leading-tight">
              Transform Products into
              <br />
              <span className="text-gray-700">Professional AI Ads</span>
            </h1>
            
            <p className="text-xl text-gray-600 leading-relaxed max-w-lg">
              Upload your product photo and watch our AI create stunning cover images and engaging video advertisements in minutes. Get started with 100 free credits - enough for your first professional AI advertisement.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <SignedOut>
                <button
                  onClick={() => setShowUpload(true)}
                  className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors flex items-center gap-3 min-w-[240px] justify-center"
                >
                  <ArrowUpTrayIcon className="w-5 h-5" />
                  Upload Product Photo
                </button>
              </SignedOut>
              
              <SignedIn>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors flex items-center gap-3 min-w-[240px] justify-center"
                >
                  Go to Dashboard
                  <ArrowRightIcon className="w-5 h-5" />
                </button>
              </SignedIn>

              <button
                onClick={() => router.push('/pricing')}
                className="border border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors min-w-[200px]"
              >
                View Pricing
              </button>
            </div>

            {/* Social Proof */}
            <div className="flex items-center gap-3 text-sm text-gray-500 pt-4">
              <div className="flex -space-x-1">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-2 border-white"></div>
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full border-2 border-white"></div>
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full border-2 border-white"></div>
              </div>
              <span>Join 50,000+ marketers worldwide</span>
            </div>
          </div>

          {/* Right Video Demo */}
          <div className="relative">
            <div className="bg-gray-50 rounded-2xl overflow-hidden shadow-2xl">
              <video 
                className="w-full h-auto"
                autoPlay 
                muted 
                loop 
                playsInline
                poster="https://tempfile.aiquickdraw.com/s/2d20e399065cf0bd885f1cd9d77b45c0_0_1756032920_4230.png"
              >
                <source 
                  src="https://tempfile.aiquickdraw.com/p/c1dc5ad1d1e55eecdc8375483407c865_1756033014.mp4" 
                  type="video/mp4" 
                />
                Your browser does not support the video tag.
              </video>
              
              {/* Play Icon Overlay for visual enhancement */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-4 opacity-0 hover:opacity-100 transition-opacity">
                  <PlayIcon className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
            
            {/* Feature callout */}
            <div className="absolute -bottom-6 left-6 bg-white rounded-lg shadow-lg p-4 border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">AI Magic in Action</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">Watch static images transform into dynamic video ads</p>
            </div>
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <h3 className="text-2xl font-bold mb-4">Get Started with Free Credits</h3>
              <p className="text-gray-600 mb-6">
                Sign up now and receive 100 free credits to create your first professional AI advertisement. No credit card required.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => router.push('/sign-up')}
                  className="flex-1 bg-gray-900 text-white px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors font-semibold"
                >
                  Start Free
                </button>
                <button
                  onClick={() => setShowUpload(false)}
                  className="flex-1 border border-gray-300 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
            Everything You Need to Create Professional Ads
          </h2>
          <p className="text-lg text-gray-600 mb-16 max-w-3xl mx-auto">
            Our AI-powered platform handles the entire process from product analysis to final video creation.
          </p>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ArrowUpTrayIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-3 text-xl">Smart Upload</h3>
              <p className="text-gray-600">
                Simply upload your product photo and our AI automatically analyzes features, benefits, and target audience.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <PlayIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-3 text-xl">AI Generation</h3>
              <p className="text-gray-600">
                Advanced AI creates professional cover images and dynamic video advertisements optimized for conversions.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ArrowRightIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-3 text-xl">Instant Export</h3>
              <p className="text-gray-600">
                Download your professional advertisements in multiple formats ready for social media and marketing campaigns.
              </p>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="pb-20">
          <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-3xl p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Transform Your Product Marketing?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join 50,000+ marketers worldwide who trust Flowtra to create professional AI-powered advertisements.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <SignedOut>
                <button
                  onClick={() => router.push('/sign-up')}
                  className="bg-white text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors min-w-[200px]"
                >
                  Start Free Today
                </button>
              </SignedOut>
              <SignedIn>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="bg-white text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors min-w-[200px]"
                >
                  Go to Dashboard
                </button>
              </SignedIn>
              <button
                onClick={() => router.push('/pricing')}
                className="border border-gray-400 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-white/10 transition-colors min-w-[200px]"
              >
                View Pricing
              </button>
            </div>
            <div className="mt-8 text-sm text-gray-400">
              100 free credits • No credit card required • Start in seconds
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}