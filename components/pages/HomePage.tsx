'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import { Zap, TrendingUp, Hand, Volume2, VolumeX, Image as ImageIcon, Video as VideoIcon, BarChart3, Clock } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { useRef, useMemo, useCallback } from 'react';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FlowtraLoading from '@/components/ui/FlowtraLoading';

export default function HomePage() {
  const { user, isLoaded } = useUser();
  const { credits, creditsData } = useCredits();
  const [stats, setStats] = useState({
    totalVideos: 0,
    thisMonth: 0,
    creditsUsed: 0,
    hoursSaved: 0,
  });
  const [onboardingProgress, setOnboardingProgress] = useState<{
    hasBrand: boolean;
    hasProduct: boolean;
    hasCreatedAd: boolean;
    tasksCompleted: number;
    totalTasks: number;
  } | null>(null);

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
        setOnboardingProgress(data.onboardingProgress || null);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Loading state
  if (!isLoaded) {
    return <FlowtraLoading />;
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        credits={credits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="md:ml-72 ml-0 bg-background min-h-screen">
        <div className="px-8 md:px-12 lg:px-16 pb-12 max-w-[1280px] mx-auto pt-16 md:pt-12">
          {/* Header Section - Minimalist with generous spacing */}
          <div className="mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground tracking-tight mb-3">
              Hello, {getUserName()}
            </h1>
            <p className="text-base text-muted-foreground">Your creative dashboard at a glance</p>
          </div>

          {/* Stats Cards - Geometric precision with minimal shadows */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="bg-card border-border border rounded-xl p-6 hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-shadow duration-300">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-foreground mb-1">{stats.totalVideos}</div>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Total Videos</div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border-border border rounded-xl p-6 hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-shadow duration-300">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-foreground mb-1">{stats.thisMonth}</div>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">This Month</div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border-border border rounded-xl p-6 hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-shadow duration-300">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-foreground mb-1">{stats.creditsUsed}</div>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Credits Used</div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border-border border rounded-xl p-6 hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-shadow duration-300">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-foreground mb-1">{stats.hoursSaved}</div>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Hours Saved</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Onboarding Progress Component */}
          {onboardingProgress && (
            <OnboardingProgress
              progress={onboardingProgress}
              className="mb-16"
            />
          )}

          {/* Discover Section - Pure media masonry grid */}
          <DiscoverSection />

        </div>
      </div>
    </div>
  );
}

// --- Discover Section --- //
type DiscoverType = 'all' | 'competitor-ugc-replication' | 'character' | 'motion-swap';

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
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  const filtered = useMemo(() => {
    const validItems = items.filter(i => !brokenImageIds.has(i.id));
    if (filter === 'all') return validItems;
    return validItems.filter(i => i.type === filter);
  }, [items, filter, brokenImageIds]);

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
        const res = await fetch('/api/discover?limit=8');
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

  const handleImageError = (id: string) => {
    setBrokenImageIds(prev => new Set([...prev, id]));
  };

  return (
    <Card className="bg-card border-border border rounded-xl overflow-hidden">
      {/* Minimalist type filter with Tabs */}
      <div className="px-8 py-6 border-b border-border">
        <h2 className="text-3xl font-semibold text-foreground mb-6">Discover</h2>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as DiscoverType)} className="w-full">
          <TabsList className="bg-muted border border-border rounded-lg p-1">
            <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-all">
              All
            </TabsTrigger>
            <TabsTrigger value="competitor-ugc-replication" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-all">
              Viral Clone
            </TabsTrigger>
            <TabsTrigger value="character" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-all">
              Character
            </TabsTrigger>
            <TabsTrigger value="motion-swap" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-all">
              Motion Swap
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Masonry grid */}
      <div className="px-8 py-8">
        {loading && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 bg-muted rounded-xl animate-pulse border border-border" />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="text-center text-sm text-muted-foreground py-12">Failed to load content</div>
        )}
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6">
          {filtered.map((item) => (
            <div key={item.id} className="mb-6 break-inside-avoid">
              <div
                className="group relative w-full rounded-xl overflow-hidden border border-border bg-muted hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)] transition-all duration-300"
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
                  onError={() => handleImageError(item.id)}
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
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* Volume button */}
                {item.videoUrl && (
                  <button
                    aria-label="toggle-sound"
                    onClick={(e) => { e.stopPropagation(); toggleVolumeClick(item.id); }}
                    className="absolute top-3 right-3 p-2.5 rounded-lg bg-background/80 text-foreground border border-border opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 hover:bg-background"
                  >
                    {(() => {
                      const el = videoRefs.current[item.id];
                      const isMuted = !el || el.muted;
                      return isMuted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      );
                    })()}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
