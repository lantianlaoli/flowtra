'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { Zap, TrendingUp, Hand, Volume2, VolumeX, Image as ImageIcon, Layers, Video as VideoIcon, BarChart3, Clock } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { useRef, useMemo, useCallback } from 'react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { OnboardingTrigger } from '@/components/onboarding/OnboardingTrigger';

export default function HomePage() {
  const { user, isLoaded } = useUser();
  const { credits } = useCredits();
  const { status, completeOnboarding, resetOnboarding } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stats, setStats] = useState({
    totalVideos: 0,
    thisMonth: 0,
    creditsUsed: 0,
    hoursSaved: 0,
  });

  // Show onboarding if not completed
  useEffect(() => {
    if (!status.loading && !status.completed) {
      setShowOnboarding(true);
    }
  }, [status.loading, status.completed]);

  // Fetch recent videos and stats
  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/user-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Loading state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const getUserName = () => {
    if (user?.firstName) {
      return user.firstName;
    }
    if (user?.emailAddresses?.[0]?.emailAddress) {
      return user.emailAddresses[0].emailAddress.split('@')[0];
    }
    return 'Guest';
  };

  const handleCompleteOnboarding = async () => {
    const success = await completeOnboarding();
    if (success) {
      setShowOnboarding(false);
    }
  };

  const handleSkipOnboarding = async () => {
    await completeOnboarding();
    setShowOnboarding(false);
  };

  const handleTriggerOnboarding = async () => {
    const success = await resetOnboarding();
    if (success) {
      setShowOnboarding(true);
    }
  };


  return (
    <>
      {/* Onboarding Tour */}
      {showOnboarding && (
        <OnboardingTour
          onComplete={handleCompleteOnboarding}
          onSkip={handleSkipOnboarding}
        />
      )}

      {/* Onboarding Trigger Button */}
      {!showOnboarding && status.completed && (
        <OnboardingTrigger onTrigger={handleTriggerOnboarding} />
      )}

      <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={credits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
        onTriggerOnboarding={handleTriggerOnboarding}
      />
      
      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen pt-14 md:pt-0">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2 min-w-0">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <Hand className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mobile-ellipsis">
                Hello, {getUserName()}
              </h1>
            </div>
          </div>

          {/* Stats Cards - Compact Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex items-baseline gap-2 min-w-0 w-full">
                  <span className="text-xl sm:text-2xl font-bold text-gray-900">{stats.totalVideos}</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-600 truncate flex-1">Total Videos Created</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex items-baseline gap-2 min-w-0 w-full">
                  <span className="text-xl sm:text-2xl font-bold text-gray-900">{stats.thisMonth}</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-600 truncate flex-1">Ads This Month</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex items-baseline gap-2 min-w-0 w-full">
                  <span className="text-xl sm:text-2xl font-bold text-gray-900">{stats.creditsUsed}</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-600 truncate flex-1">Credits Used</span>
                </div>
              </div>
            </div>

            {/* Hours Saved */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex items-baseline gap-2 min-w-0 w-full">
                  <span className="text-xl sm:text-2xl font-bold text-gray-900">{stats.hoursSaved}</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-600 truncate flex-1">Hours Saved</span>
                </div>
              </div>
            </div>
          </div>

          {/* Discover Section - Pure media masonry grid */}
          <DiscoverSection />

        </div>
      </div>
    </div>
    </>
  );
}

// --- Discover Section --- //
type DiscoverType = 'all' | 'standard' | 'multi-variant' | 'character';

interface DiscoverItem {
  id: string;
  type: Exclude<DiscoverType, 'all'>;
  coverImageUrl: string;
  videoUrl?: string;
  createdAt?: string;
}

function DiscoverSection() {
  const [filter, setFilter] = useState<DiscoverType>('all');
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audibleId, setAudibleId] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(i => i.type === filter);
  }, [items, filter]);

  const setVideoRef = useCallback((id: string, el: HTMLVideoElement | null) => {
    videoRefs.current[id] = el;
  }, []);

  // IntersectionObserver: play/pause based on viewport
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target as HTMLVideoElement;
        if (!el) return;
        if (entry.isIntersecting) {
          // Begin silent autoplay
          el.muted = audibleId !== el.dataset.id; // ensure muted unless this is audible one
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      });
    }, { threshold: 0.25 });

    // Observe all current videos
    Object.entries(videoRefs.current).forEach(([id, el]) => {
      if (el) {
        el.dataset.id = id;
        observerRef.current?.observe(el);
      }
    });

    return () => observerRef.current?.disconnect();
  }, [filtered, audibleId]);

  // Fetch real data
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/discover?limit=48');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
        setItems(data.items || []);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Hover handlers: exclusive audio on one card
  const handleMouseEnter = (id: string) => {
    setAudibleId(id);
    Object.entries(videoRefs.current).forEach(([vid, el]) => {
      if (!el) return;
      if (vid === id) {
        // Try to unmute; if blocked, stays muted until user clicks volume
        el.muted = false;
        el.volume = 1;
        el.play().catch(() => {});
      } else {
        el.muted = true;
      }
    });
  };

  const fadeOutAndMute = (el: HTMLVideoElement) => {
    const start = el.volume;
    const duration = 200; // 200ms fade out
    const startTs = performance.now();
    const step = (ts: number) => {
      const p = Math.min(1, (ts - startTs) / duration);
      const v = start * (1 - p);
      el.volume = v;
      if (p < 1) requestAnimationFrame(step);
      else {
        el.muted = true;
        el.volume = 1; // reset for next unmute
      }
    };
    requestAnimationFrame(step);
  };

  const handleMouseLeave = (id: string) => {
    if (audibleId === id) setAudibleId(null);
    const el = videoRefs.current[id];
    if (el) fadeOutAndMute(el);
  };

  const toggleVolumeClick = (id: string) => {
    const el = videoRefs.current[id];
    if (!el) return;
    const willUnmute = el.muted;
    if (willUnmute) {
      // make this the only audible video
      setAudibleId(id);
      Object.entries(videoRefs.current).forEach(([vid, v]) => {
        if (!v) return;
        if (vid === id) {
          v.muted = false;
          v.volume = 1;
          v.play().catch(() => {});
        } else {
          v.muted = true;
        }
      });
    } else {
      fadeOutAndMute(el);
      setAudibleId(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Icon-only type filter */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { k: 'all', icon: ImageIcon, label: 'All' },
              { k: 'standard', icon: ImageIcon, label: 'Standard' },
              { k: 'multi-variant', icon: Layers, label: 'Multi-Variant' },
              { k: 'character', icon: VideoIcon, label: 'Character' },
            ] as const
          ).map(({ k, icon: Icon, label }) => (
            <button
              key={k}
              aria-label={label}
              onClick={() => setFilter(k as DiscoverType)}
              className={`h-8 px-2.5 flex items-center gap-2 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filter === k ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Masonry grid */}
      <div className="p-4">
        {loading && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="text-center text-sm text-gray-500 py-8">Failed to load</div>
        )}
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]"></div>
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="mb-4 break-inside-avoid">
              <div
                className="group relative w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200"
                onMouseEnter={() => item.videoUrl && handleMouseEnter(item.id)}
                onMouseLeave={() => item.videoUrl && handleMouseLeave(item.id)}
              >
                {/* Cover image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.coverImageUrl}
                  alt="ad"
                  loading="lazy"
                  className="w-full h-auto block"
                />

                {/* Auto-playing video overlay (if present) */}
                {item.videoUrl && (
                  <video
                    ref={(el) => setVideoRef(item.id, el)}
                    src={item.videoUrl}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                    loop
                    preload="metadata"
                    // Allow click-through except on volume btn
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Volume button: show on hover (desktop) and always on mobile */}
                {item.videoUrl && (
                  <button
                    aria-label="toggle-sound"
                    onClick={(e) => { e.stopPropagation(); toggleVolumeClick(item.id); }}
                    className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    {audibleId === item.id ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
