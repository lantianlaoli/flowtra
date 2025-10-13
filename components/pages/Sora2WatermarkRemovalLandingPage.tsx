'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useUser, SignInButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  CheckCircle,
  Shield,
  Clock,
  ArrowRight,
  Video,
  ChevronDown,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import VideoPlayer from '@/components/ui/VideoPlayer';
import { WATERMARK_REMOVAL_COST } from '@/lib/constants';

export default function Sora2WatermarkRemovalLandingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Input state
  const [videoUrl, setVideoUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleSubmit = async () => {
    if (!user) {
      showError('Please sign in to remove watermarks');
      return;
    }

    if (!videoUrl.trim()) {
      setError('Please enter a Sora2 video URL');
      return;
    }

    if (!videoUrl.startsWith('https://sora.chatgpt.com/')) {
      setError('Invalid Sora video URL. Must start with https://sora.chatgpt.com/');
      return;
    }

    setError('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/watermark-removal/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          videoUrl: videoUrl.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        showSuccess('Processing started! Check My Ads to view your video');
        // Redirect to My Ads page
        router.push('/dashboard/videos');
      } else {
        setError(data.error || 'Failed to start processing. Please try again.');
        showError(data.error || 'Failed to start processing');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('Failed to start processing. Please try again later.');
      showError('Failed to start processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const faqs = [
    {
      question: "What is Sora2?",
      answer: "Sora2 is OpenAI's advanced video generation model accessible through ChatGPT. It creates high-quality videos from text prompts, but includes watermarks on all generated videos."
    },
    {
      question: "How long does watermark removal take?",
      answer: "Most videos are processed in 2-5 minutes. You'll receive real-time status updates, and can download your watermark-free video as soon as processing completes."
    },
    {
      question: "What if the watermark removal fails?",
      answer: "If processing fails for any reason, your 3 credits are automatically refunded to your account. No questions asked, no manual refund requests needed."
    },
    {
      question: "Can I download the video multiple times?",
      answer: "Yes! Once you've paid the 3 credits to remove the watermark, you can download your video as many times as you need at no additional cost."
    },
    {
      question: "What video formats are supported?",
      answer: "We support all Sora2 video outputs from ChatGPT. The final video is delivered in high-quality MP4 format, compatible with all major platforms and devices."
    },
    {
      question: "Is my video URL safe?",
      answer: "Absolutely. We only use your video URL to process the watermark removal. Your videos are not stored permanently and are automatically deleted after 30 days."
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="pt-12 pb-16 md:pt-20 md:pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full mb-6">
                <Video className="w-4 h-4 text-gray-700" />
                <span className="text-sm font-medium text-gray-700">Professional Sora2 Video Processing</span>
              </div>

              {/* Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Remove <span className="text-gray-900 underline decoration-[6px] decoration-gray-900">Sora2 Watermarks</span> Instantly
              </h1>

              <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-3xl mx-auto">
                Transform your ChatGPT Sora2 videos into professional, watermark-free content.
                Fast processing, automatic refunds, and high-quality results.
              </p>

              {/* Key Benefits */}
              <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Only {WATERMARK_REMOVAL_COST} Credits</span>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">10-30 Seconds</span>
                </div>
                <div className="flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-lg border border-purple-200">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Auto Refund</span>
                </div>
              </div>
            </div>

            {/* Static Before/After Demo */}
            <div className="bg-white rounded-3xl border-2 border-gray-200 p-8 shadow-xl mb-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">See The Difference</h2>
                <p className="text-gray-600">Watch how we transform watermarked Sora2 videos into clean, professional content</p>
              </div>

              {/* Static Before/After Comparison */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                {/* Before - With Watermark */}
                <div className="flex-1 max-w-xs">
                  <div className="relative">
                    <div className="aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden border-2 border-red-300 shadow-lg">
                      <VideoPlayer
                        src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/sora2-watermark.mp4"
                        className="w-full h-full object-contain"
                        showControls={true}
                        ariaLabel="Original Sora2 video with watermark"
                      />
                    </div>
                    <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-md text-sm font-bold shadow-lg">
                      With Watermark
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-3">Original from ChatGPT Sora</p>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <ArrowRight className="w-8 h-8 text-green-600 transform md:rotate-0 rotate-90" />
                    <span className="text-sm font-medium text-green-600 hidden md:block">Processed</span>
                  </div>
                </div>

                {/* After - Without Watermark */}
                <div className="flex-1 max-w-xs">
                  <div className="relative">
                    <div className="aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden border-2 border-green-300 shadow-lg">
                      <VideoPlayer
                        src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/sora2-non-watermark.mp4"
                        className="w-full h-full object-contain"
                        showControls={true}
                        ariaLabel="Processed video without watermark by Flowtra"
                      />
                    </div>
                    <div className="absolute top-3 left-3 bg-green-500 text-white px-3 py-1 rounded-md text-sm font-bold shadow-lg flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      <span>No Watermark</span>
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-3">Processed by Flowtra</p>
                </div>
              </div>
            </div>

            {/* Try Your Own Video Section */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl border-2 border-gray-200 p-8 shadow-xl">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Try It With Your Own Video</h2>
                <p className="text-gray-600">
                  {user ? 'Paste your Sora2 video URL to start processing' : 'Sign in to remove watermarks from your videos'}
                </p>
              </div>

              {/* Input Section */}
              <div className="max-w-2xl mx-auto mb-8">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://sora.chatgpt.com/p/..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                    disabled={!user || isProcessing}
                  />
                  {!user ? (
                    <SignInButton mode="modal" forceRedirectUrl="/dashboard/watermark-removal">
                      <button className="bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap">
                        <Sparkles className="w-5 h-5" />
                        <span>Sign In to Start</span>
                      </button>
                    </SignInButton>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isProcessing || !videoUrl.trim()}
                      className="bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Starting...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          <span>Remove Watermark</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-900">{error}</p>
                  </div>
                )}

                {!user && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900 text-center">
                      <strong>New users get 100 free credits</strong> - Enough for 33 watermark removals!
                    </p>
                  </div>
                )}
              </div>

              {/* Info Display */}
              <div className="text-center text-gray-500 py-4">
                <Video className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-base font-medium text-gray-700">
                  {user ? 'Enter your Sora2 URL and click "Remove Watermark"' : 'Sign in to start removing watermarks'}
                </p>
                <p className="text-sm mt-2 text-gray-500">
                  Only {WATERMARK_REMOVAL_COST} credits per video • Automatic refund on failure
                </p>
              </div>
            </div>

            {/* CTA Button Below Demo */}
            <div className="text-center mt-12">
              {!isLoaded ? (
                <button
                  disabled
                  className="bg-gray-300 text-gray-500 px-8 py-4 rounded-lg text-lg font-semibold cursor-not-allowed opacity-50 inline-flex items-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Loading...</span>
                </button>
              ) : user ? (
                <Link
                  href="/dashboard/watermark-removal"
                  className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Remove Watermark Now</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/dashboard/watermark-removal">
                  <button className="bg-gray-900 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors inline-flex items-center gap-2 cursor-pointer">
                    <Sparkles className="w-5 h-5" />
                    <span>Get Started Free</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </SignInButton>
              )}
              <p className="text-sm text-gray-500 mt-4">Free demo • No registration required for demo</p>
            </div>
          </div>
        </section>

        {/* Tutorial Section - How to Get Your Sora2 Video Link */}
        <section className="py-16 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                How to Get Your Sora2 Video Link
              </h2>
              <p className="text-lg text-gray-600">
                Follow these simple steps to get the link from your ChatGPT Sora video
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12">
              {/* Step 1 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Open Sora Explorer</h3>
                <p className="text-gray-600 mb-4">
                  Visit{' '}
                  <a
                    href="https://sora.chatgpt.com/explore"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-medium"
                  >
                    sora.chatgpt.com/explore
                  </a>
                  {' '}and log in to your ChatGPT account.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Go to Your Profile</h3>
                <p className="text-gray-600 mb-4">
                  Click on your profile icon or personal homepage to see all your generated videos.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <div className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center text-xl font-bold mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Copy Video URL</h3>
                <p className="text-gray-600 mb-4">
                  Open the video you want to process, then copy the URL from your browser&apos;s address bar.
                </p>
              </div>
            </div>

            {/* Visual Guide with Screenshot */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4 text-center">Visual Guide</h3>
              <p className="text-gray-600 text-center mb-6">
                Here&apos;s what it looks like when you copy the URL from your browser
              </p>
              <div className="relative max-w-4xl mx-auto rounded-xl overflow-hidden border-2 border-gray-300 shadow-xl">
                <Image
                  src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/landing_page/sora2-link-copy.png"
                  alt="Screenshot showing how to copy Sora2 video URL from browser address bar"
                  width={1200}
                  height={675}
                  className="w-full h-auto"
                  priority
                  unoptimized
                />
              </div>
              <p className="text-sm text-gray-500 text-center mt-4">
                Copy the full URL starting with https://sora.chatgpt.com/p/...
              </p>
            </div>
          </div>
        </section>



        {/* Pricing Section */}
        <section className="py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Only pay for what you use. No subscriptions, no hidden fees.
            </p>

            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-gray-200">
              <div className="text-5xl font-bold text-gray-900 mb-2">
                {WATERMARK_REMOVAL_COST} Credits
              </div>
              <div className="text-xl text-gray-600 mb-6">
                (~$0.05) per video
              </div>

              <ul className="space-y-3 mb-8 text-left max-w-md mx-auto">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">2-5 minutes processing time</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Automatic refund on failure</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Unlimited downloads after processing</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">Professional quality output</span>
                </li>
              </ul>

              <div className="mb-6">
                <Link
                  href="/#pricing"
                  className="text-blue-600 hover:underline font-medium"
                >
                  View credit packages →
                </Link>
              </div>

              {!isLoaded ? (
                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 py-4 rounded-lg text-lg font-semibold cursor-not-allowed opacity-50"
                >
                  Loading...
                </button>
              ) : user ? (
                <Link
                  href="/dashboard/watermark-removal"
                  className="w-full bg-gray-900 text-white py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Start Removing Watermarks</span>
                </Link>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/dashboard/watermark-removal">
                  <button className="w-full bg-gray-900 text-white py-4 rounded-lg text-lg font-semibold hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-2 cursor-pointer">
                    <Sparkles className="w-5 h-5" />
                    <span>Get Started Free</span>
                  </button>
                </SignInButton>
              )}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-gray-600">
                Everything you need to know about Sora2 watermark removal
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-lg font-semibold text-gray-900 pr-4">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                        openFaq === index ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-5">
                      <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 shadow-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Remove Watermarks?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join hundreds of creators using Flowtra for professional Sora2 videos
            </p>

            {!isLoaded ? (
              <button
                disabled
                className="bg-white text-gray-400 px-8 py-4 rounded-lg text-lg font-semibold cursor-not-allowed opacity-50"
              >
                Loading...
              </button>
            ) : user ? (
              <Link
                href="/dashboard/watermark-removal"
                className="bg-white text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-5 h-5" />
                <span>Get Started Now</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <SignInButton mode="modal" forceRedirectUrl="/dashboard/watermark-removal">
                <button className="bg-white text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center gap-2 cursor-pointer">
                  <Sparkles className="w-5 h-5" />
                  <span>Get Started Free</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </SignInButton>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
