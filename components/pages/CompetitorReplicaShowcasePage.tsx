'use client';

import Link from 'next/link';
import Script from 'next/script';
import {
  SparklesIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import {
  Copy,
  Zap,
  Target,
  Sparkles,
  Users,
  Globe,
  Clock,
  Scissors,
  Link as LinkIcon
} from 'lucide-react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { LazyVideoPlayer } from '@/components/pages/landing/LazyVideoPlayer';
import { BookDemoCTA } from '@/components/cta/BookDemoCTA';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { TikTokAnalysisModal } from '@/components/showcase/TikTokAnalysisModal';
import { useToast } from '@/contexts/ToastContext';

export default function CompetitorReplicaShowcasePage() {
  const { isSignedIn } = useUser();
  const { showError } = useToast();
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [selectedTikTokUrl, setSelectedTikTokUrl] = useState('');
  const [hasUsedFreeAnalysis, setHasUsedFreeAnalysis] = useState(false);

  // Check if user has already used free analysis
  useEffect(() => {
    const analysisUsed = sessionStorage.getItem('tiktok_analysis_used');
    if (analysisUsed) {
      setHasUsedFreeAnalysis(true);
    }
  }, []);

  const isValidTikTokUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
      /^https?:\/\/vm\.tiktok\.com\/[\w]+/
    ];
    return patterns.some(pattern => pattern.test(url.trim()));
  };

  const handleAnalyzeTikTok = () => {
    // Check session rate limit
    const analysisUsed = sessionStorage.getItem('tiktok_analysis_used');
    if (analysisUsed) {
      showError('You have already used your free analysis for this session. Sign up to analyze more videos!');
      return;
    }

    // Validate TikTok URL
    if (!tiktokUrl || !isValidTikTokUrl(tiktokUrl)) {
      showError('Please enter a valid TikTok video URL');
      return;
    }

    // Open modal (no redirect, no auth check)
    setSelectedTikTokUrl(tiktokUrl);
    setIsAnalysisModalOpen(true);
  };

  const features = [
    {
      icon: Copy,
      title: 'Clone Creative Structure',
      description: 'AI analyzes competitor videos to extract the complete narrative structure, camera movements, and visual style.',
    },
    {
      icon: Sparkles,
      title: 'Smart Product Replacement',
      description: 'Seamlessly replace competitor products with yours while maintaining the proven creative framework.',
    },
    {
      icon: Zap,
      title: 'Minutes, Not Days',
      description: 'Launch competitive creatives in minutes instead of weeks of production time and creative brainstorming.',
    },
    {
      icon: Target,
      title: 'Proven Performance',
      description: 'Build on top-performing competitor ads that have already proven to resonate with your target audience.',
    },
    {
      icon: Users,
      title: 'Consistent Characters',
      description: 'Maintain the same character appearance across all segments and shots, ensuring a seamless and believable narrative.',
    },
  ];

  const useCases = [
    'Quick Market Entry',
    'Competitive Analysis',
    'A/B Testing',
    'Product Launches',
    'Social Media Ads',
    'E-commerce Marketing',
    'Dropshipping Stores',
    'Brand Competition',
  ];

  const demoAnalysisData = {
    name: "elf-glow-reviver-lip-oil-swatch",
    detected_language: "es",
    video_duration_seconds: 15,
    shots: [
      {
        shot_id: 1,
        start_time: "00:00",
        end_time: "00:03",
        action: "Hand presents four boxes of lip oil to the camera",
        audio: "Voiceover: 'Te pedí cuatro tonos...'",
        first_frame_description: "A close-up, first-person perspective shot features a hand holding four distinct boxes..."
      },
      {
        shot_id: 2,
        start_time: "00:03",
        end_time: "00:05",
        action: "Woman holds up the specific shade 'Crystal Baller'",
        audio: "Voiceover: 'El primero es Crystal Baller...'",
        first_frame_description: "A close-up of a single rectangular product bottle held between thumb and forefinger..."
      },
      {
        shot_id: 3,
        start_time: "00:05",
        end_time: "00:09",
        action: "Applying the lip oil to lips",
        audio: "Voiceover: '...que tiene destellitos...'",
        first_frame_description: "A medium close-up centers on a young woman with long brunette hair..."
      },
      {
        shot_id: 4,
        start_time: "00:09",
        end_time: "00:13",
        action: "Detailed application and display of glossy finish",
        audio: "Voiceover: 'De una vez les digo...'",
        first_frame_description: "An extreme close-up focuses entirely on the lower half of the woman's face..."
      },
      {
        shot_id: 5,
        start_time: "00:13",
        end_time: "00:15",
        action: "Presenting the 'Candy Coated' shade",
        audio: "Voiceover: 'Seguimos con el tono...'",
        first_frame_description: "The frame transitions to the model holding a new shade open..."
      }
    ]
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero Section */}
      <section className="pt-24 pb-16 lg:pt-32 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-4 py-2 bg-black text-white rounded-full mb-6">
                <span className="text-sm font-semibold">Replica UGC Demo</span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-6 leading-tight">
                Clone a Top Competitor Video
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Flowtra mapped this entire competitor ad beat-for-beat, swapped the product, and delivered a launch-ready clone in minutes. Same structure. Same energy. Your brand.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/dashboard/competitor-ugc-replication"
                  className="inline-flex items-center justify-center px-8 py-4 bg-black text-white rounded-lg font-semibold hover:bg-black/90 active:scale-[0.98] transition-all shadow-sm"
                >
                  Start Cloning
                  <ArrowRightIcon className="ml-2 w-5 h-5" />
                </Link>
                <Link
                  href="/#pricing"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white text-black border border-[#E5E5E5] rounded-lg font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm"
                >
                  View Pricing
                </Link>
              </div>
            </div>
            
            {/* Hero Right: Side-by-Side Comparison */}
            <div className="flex justify-center lg:justify-end w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-[600px]">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-full text-sm font-semibold text-gray-700">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Competitor Video
                  </div>
                  <div className="relative aspect-[9/16] w-full bg-gray-100 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/clone_competitor_origin.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      showControls
                      playsInline
                      loop
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-sm font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Flowtra Clone
                  </div>
                  <div className="relative aspect-[9/16] w-full bg-gray-100 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/clone_competitor_result.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      showControls
                      playsInline
                      loop
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tutorial Section (New) */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Steps */}
              <div className="space-y-8">
                 <h2 className="text-3xl md:text-4xl font-bold text-black mb-6">
                    Clone in 5 Simple Steps
                 </h2>
                 <div className="space-y-6">
                    {/* Step 1 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">1</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Configure Brand & Product</h3>
                          <p className="text-gray-600 mt-1">Upload your product image and define your brand details.</p>
                       </div>
                    </div>
                    {/* Step 2 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">2</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Upload & Analyze</h3>
                          <p className="text-gray-600 mt-1">Upload a competitor UGC video. AI automatically analyzes the shot content.</p>
                       </div>
                    </div>
                    {/* Step 3 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">3</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Select Video to Clone</h3>
                          <p className="text-gray-600 mt-1">Choose the specific video you want to replicate.</p>
                       </div>
                    </div>
                    {/* Step 4 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">4</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Edit Segments & Prompts</h3>
                          <p className="text-gray-600 mt-1">Edit segment photos and video prompts until satisfied.</p>
                       </div>
                    </div>
                    {/* Step 5 */}
                    <div className="flex gap-4">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold">5</div>
                       <div>
                          <h3 className="text-xl font-semibold text-black">Merge Final Video</h3>
                          <p className="text-gray-600 mt-1">Combine segments to generate the final video.</p>
                       </div>
                    </div>
                 </div>
                 <div className="pt-6">
                    <Link
                      href="/dashboard/competitor-ugc-replication"
                      className="inline-flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-lg text-base font-semibold hover:bg-black/90 active:scale-[0.98] transition-all shadow-sm"
                    >
                      Start Cloning
                      <ArrowRightIcon className="w-4 h-4" />
                    </Link>
                 </div>
              </div>

              {/* Right: TikTok Video */}
              <div className="flex justify-center lg:justify-end w-full">
                <blockquote
                  className="tiktok-embed"
                  cite="https://www.tiktok.com/@laolilantian/video/7588829935922351378"
                  data-video-id="7588829935922351378"
                  style={{ maxWidth: '605px', minWidth: '325px' }}
                >
                  <section>
                    <a target="_blank" title="@laolilantian" href="https://www.tiktok.com/@laolilantian?refer=embed">
                      @laolilantian
                    </a>{' '}
                    Watch how we quickly clone viral videos and swap products using our optimized tool. Adjust every frame and prompt in the editor for perfect results.{' '}
                    <a title="videoai" target="_blank" href="https://www.tiktok.com/tag/videoai?refer=embed">
                      #VideoAI
                    </a>{' '}
                    <a title="contentcreation" target="_blank" href="https://www.tiktok.com/tag/contentcreation?refer=embed">
                      #ContentCreation
                    </a>{' '}
                    <a title="productmarketing" target="_blank" href="https://www.tiktok.com/tag/productmarketing?refer=embed">
                      #ProductMarketing
                    </a>{' '}
                    <a title="techdemo" target="_blank" href="https://www.tiktok.com/tag/techdemo?refer=embed">
                      #TechDemo
                    </a>{' '}
                    <a target="_blank" title="♬ original sound  - Lantian laoli" href="https://www.tiktok.com/mus/original-sound-Lantian-laoli-7588830007134063381?refer=embed">
                      ♬ original sound  - Lantian laoli
                    </a>
                  </section>
                </blockquote>
                <Script src="https://www.tiktok.com/embed.js" strategy="afterInteractive" />
              </div>
           </div>
        </div>
      </section>

      {/* AI Analysis Demo Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start">

            {/* Left: AI Analysis Results (Notion Style) */}
            <div className="space-y-8">
               <div>
                  <div className="inline-block px-3 py-1 bg-black text-white text-xs font-mono rounded mb-4">
                    AI Analysis Result
                  </div>
                  <h2 className="text-3xl font-bold text-black mb-4">Deep Video Understanding</h2>
                  <p className="text-gray-600 mb-6 leading-relaxed">
                    Our AI deconstructs every second of the video, capturing timing, actions, voiceovers, and camera angles to recreate the winning formula.
                  </p>

                  {/* Selling Points */}
                  <div className="flex flex-wrap gap-3 mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm">
                      <Globe className="w-4 h-4 text-blue-500" />
                      <span>10+ Languages Detected</span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span>Up to 60s Video</span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 shadow-sm">
                      <Scissors className="w-4 h-4 text-purple-500" />
                      <span>Auto-Scene Detection</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <LinkIcon className="w-5 h-5 text-gray-400" />
                        </div>
                        <input
                          type="url"
                          placeholder="Paste TikTok video URL..."
                          value={tiktokUrl}
                          onChange={(e) => setTiktokUrl(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 border border-[#E5E5E5] rounded-lg text-base font-medium placeholder:text-gray-400 bg-white focus:border-black focus:ring-1 focus:ring-black focus:outline-none transition-all shadow-sm"
                        />
                      </div>
                      <button
                        onClick={handleAnalyzeTikTok}
                        disabled={!tiktokUrl.trim()}
                        className="flex-shrink-0 w-12 h-[50px] inline-flex items-center justify-center bg-black text-white rounded-lg hover:bg-black/90 active:scale-[0.98] transition-all disabled:bg-[#F7F7F7] disabled:text-[#999999] disabled:border-[#E5E5E5] disabled:border disabled:cursor-not-allowed shadow-sm"
                        aria-label="Analyze TikTok Video"
                      >
                        <ArrowRightIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Rate Limit Warning */}
                    {hasUsedFreeAnalysis && (
                      <div className="p-4 bg-[#F7F6F3] border border-[#E5E5E5] rounded-lg">
                        <p className="text-sm text-[#37352F]">
                          You've used your free analysis for this session.{' '}
                          <Link href="/sign-up" className="underline font-medium text-black hover:text-[#37352F]">
                            Sign up
                          </Link>{' '}
                          to analyze more videos.
                        </p>
                      </div>
                    )}
                  </div>
               </div>

               <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden font-mono text-sm">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Video Blueprint</span>
                    <span className="text-xs text-gray-500">15s • {demoAnalysisData.shots.length} shots detected</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto p-0">
                    {demoAnalysisData.shots.map((shot) => (
                      <div key={shot.shot_id} className="border-b border-gray-100 last:border-0 p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex gap-4 mb-2">
                           <span className="text-xs font-bold text-gray-400 w-16 shrink-0 font-sans">
                             {shot.start_time} - {shot.end_time}
                           </span>
                           <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider font-sans">
                             Shot {shot.shot_id}
                           </span>
                        </div>
                        <div className="grid gap-2 pl-20">
                           <div>
                             <span className="text-gray-400 text-[10px] uppercase tracking-wide font-sans block mb-1">Action</span>
                             <p className="text-gray-800 leading-snug">{shot.action}</p>
                           </div>
                           <div>
                             <span className="text-gray-400 text-[10px] uppercase tracking-wide font-sans block mb-1">Audio</span>
                             <p className="text-gray-600 italic leading-snug">&quot;{shot.audio}&quot;</p>
                           </div>
                           <div>
                             <span className="text-gray-400 text-[10px] uppercase tracking-wide font-sans block mb-1">Visual</span>
                             <p className="text-gray-500 text-xs leading-relaxed">{shot.first_frame_description}</p>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>

            {/* Right: Video */}
            <div className="sticky top-24">
                <div className="relative aspect-[9/16] w-full max-w-sm mx-auto bg-black rounded-[2rem] overflow-hidden shadow-2xl border-4 border-black">
                    <LazyVideoPlayer
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_videos/clone_competitor_parse.mp4"
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      showControls
                      playsInline
                      loop
                      autoPlay
                    />
                </div>
            </div>

          </div>
        </div>
      </section>

      {/* Segment Editor Demo Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              
              {/* Image Side */}
              <div className="w-full lg:w-3/5">
                 <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-gray-50 group transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
                    <img 
                      src="https://aywxqxpmmtgqzempixec.supabase.co/storage/v1/object/public/images/features_images/clone_competitor_segment_edit.png" 
                      alt="Flowtra Segment Editor Interface" 
                      className="w-full h-auto"
                      loading="lazy"
                    />
                    {/* Optional subtle gradient overlay for depth */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                 </div>
              </div>

              {/* Text Side */}
              <div className="w-full lg:w-2/5 space-y-8">
                 <div>
                    <div className="inline-block px-3 py-1 bg-black text-white text-xs font-mono rounded mb-4">
                      Granular Control
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-black mb-4 leading-tight">
                       Fine-Tune Every Shot
                    </h2>
                    <p className="text-gray-600 text-lg leading-relaxed">
                       Don&apos;t just clone—perfect it. Our advanced Segment Editor gives you complete control over each shot in the sequence.
                    </p>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="flex gap-4 items-start">
                       <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <Target className="w-5 h-5 text-purple-600" />
                       </div>
                       <div>
                          <h3 className="text-lg font-semibold text-gray-900">Custom First Frames</h3>
                          <p className="text-gray-600 mt-1">Upload or generate specific starting images for each segment to guide the AI&apos;s visual consistency.</p>
                       </div>
                    </div>
                    
                    <div className="flex gap-4 items-start">
                       <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <Copy className="w-5 h-5 text-blue-600" />
                       </div>
                       <div>
                          <h3 className="text-lg font-semibold text-gray-900">Prompt Engineering</h3>
                          <p className="text-gray-600 mt-1">Edit the AI-generated prompts directly. Tweak character details, lighting, and action descriptions.</p>
                       </div>
                    </div>

                    <div className="flex gap-4 items-start">
                       <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                          <Sparkles className="w-5 h-5 text-green-600" />
                       </div>
                       <div>
                          <h3 className="text-lg font-semibold text-gray-900">Motion & Camera</h3>
                          <p className="text-gray-600 mt-1">Refine camera movements and subject motion to ensure smooth transitions between shots.</p>
                       </div>
                    </div>
                 </div>

                 <div className="pt-4">
                    <Link
                      href="/dashboard/competitor-ugc-replication"
                      className="inline-flex items-center justify-center px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-black/90 active:scale-[0.98] transition-all shadow-sm"
                    >
                      Start Editing
                      <ArrowRightIcon className="ml-2 w-4 h-4" />
                    </Link>
                 </div>
              </div>

           </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Why Choose Competitor Replica?
            </h2>
            <p className="text-lg text-gray-600">
              Leverage proven creative strategies without the guesswork
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                    <IconComponent className="w-6 h-6 text-black" />
                  </div>
                  <h3 className="text-xl font-bold text-black mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-4">
              Perfect For
            </h2>
            <p className="text-lg text-gray-600">
              Use cases where competitor replica excels
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="bg-white rounded-xl px-6 py-6 text-center border border-gray-200 hover:shadow-md transition-shadow"
              >
                <span className="text-sm font-semibold text-gray-900">
                  {useCase}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Book Demo CTA - Compact */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <BookDemoCTA
          variant="compact"
          title="Ready to Clone Competitors?"
          description="Book a demo to explore our AI-powered competitor video cloning feature."
        />
      </section>

      {/* TikTok Analysis Modal */}
      <TikTokAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        tiktokUrl={selectedTikTokUrl}
        onComplete={(result) => {
          // Mark session as used
          sessionStorage.setItem('tiktok_analysis_used', JSON.stringify({
            used: true,
            timestamp: Date.now()
          }));
          setHasUsedFreeAnalysis(true);

          // Save analysis for dashboard
          sessionStorage.setItem('showcase_tiktok_analysis', JSON.stringify({
            ...result,
            tiktokUrl: selectedTikTokUrl
          }));
        }}
      />

      <Footer />
    </div>
  );
}