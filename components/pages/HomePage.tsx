"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useCredits } from "@/contexts/CreditsContext";
import {
  Zap,
  TrendingUp,
  Hand,
  Compass,
  Image as ImageIcon,
  Video as VideoIcon,
  BarChart3,
  Clock,
  LayoutGrid,
  Copy,
  User,
  RefreshCw,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import { useRef, useMemo, useCallback } from "react";
import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FlowtraLoading from "@/components/ui/FlowtraLoading";

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
    hasImportedTiktok: boolean;
    hasProduct: boolean;
    hasAvatar: boolean;
    hasCreatedVideo: boolean;
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
      const response = await fetch("/api/user-stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
        setOnboardingProgress(data.onboardingProgress || null);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
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
      return user.emailAddresses[0].emailAddress.split("@")[0];
    }
    return "Guest";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        credits={credits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="dashboard-content-offset ml-0 bg-background min-h-screen">
        <div className="px-8 md:px-12 lg:px-16 pb-12 max-w-[1280px] mx-auto pt-8 md:pt-6">
          {/* Header Section - Minimalist with generous spacing */}
          <div className="mb-8">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground tracking-tight mb-3">
              Hello, {getUserName()}
            </h1>
            <p className="text-base text-muted-foreground">
              Your creative dashboard at a glance
            </p>
          </div>

          {/* Stats Cards - Notion minimalist horizontal layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
            <Card className="bg-card border border-border/60 rounded-lg p-4 hover:border-border transition-colors duration-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4 text-foreground" />
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-semibold text-foreground">
                    {stats.totalVideos}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Videos
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border border-border/60 rounded-lg p-4 hover:border-border transition-colors duration-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-foreground" />
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-semibold text-foreground">
                    {stats.thisMonth}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    This Month
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border border-border/60 rounded-lg p-4 hover:border-border transition-colors duration-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-foreground" />
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-semibold text-foreground">
                    {stats.creditsUsed}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Credits Used
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-card border border-border/60 rounded-lg p-4 hover:border-border transition-colors duration-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted rounded-md flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-foreground" />
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-semibold text-foreground">
                    {stats.hoursSaved}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Hours Saved
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Onboarding Progress Component */}
          {onboardingProgress && (
            <OnboardingProgress
              progress={onboardingProgress}
              className="mb-3"
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
type DiscoverType =
  | "all"
  | "competitor-ugc-replication"
  | "character"
  | "motion-swap";

interface DiscoverItem {
  id: string;
  type: Exclude<DiscoverType, "all">;
  coverImageUrl: string;
  videoUrl?: string;
  createdAt?: string;
}

const VIDEO_URL_PATTERN = /\.(mp4|mov|webm|m4v)(?:[?#].*)?$/i;

function isVideoLikeUrl(url?: string) {
  return typeof url === "string" && VIDEO_URL_PATTERN.test(url);
}

function DiscoverSection() {
  const [filter, setFilter] = useState<DiscoverType>("all");
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audibleId, setAudibleId] = useState<string | null>(null);
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set());
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const filtered = useMemo(() => {
    const validItems = items.filter(
      (i) => i.videoUrl || !brokenImageIds.has(i.id),
    );
    if (filter === "all") return validItems;
    return validItems.filter((i) => i.type === filter);
  }, [items, filter, brokenImageIds]);

  const setVideoRef = useCallback((id: string, el: HTMLVideoElement | null) => {
    videoRefs.current[id] = el;
  }, []);

  // Fetch real data
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/discover?limit=8");
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Failed");
        setItems(data.items || []);
      } catch (e: unknown) {
        const err = e as Error;
        setError(err?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Hover handlers: play only on hover, pause on leave
  const handleMouseEnter = (id: string) => {
    const el = videoRefs.current[id];
    if (!el) return;
    setAudibleId(id);
    // Try to unmute and play
    el.muted = false;
    el.volume = 1;
    el.play().catch(() => {});
  };

  const handleMouseLeave = (id: string) => {
    if (audibleId === id) setAudibleId(null);
    const el = videoRefs.current[id];
    if (el) {
      el.pause();
      el.muted = true;
    }
  };

  const handleImageError = (id: string) => {
    setBrokenImageIds((prev) => new Set([...prev, id]));
  };

  return (
    <Card className="bg-card border border-border/60 rounded-xl overflow-hidden">
      {/* Header with title left, tabs right */}
      <div className="px-4 py-2.5 border-b border-border/60">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as DiscoverType)}
          className="w-full"
        >
          <div className="flex items-center justify-between">
            {/* Title left */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center">
                <Compass className="w-5 h-5 text-foreground" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">
                Discover
              </h2>
            </div>
            {/* Tabs right */}
            <TabsList className="bg-muted border border-border/60 rounded-lg p-0.5 h-auto shrink-0">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-3 py-1.5 text-sm font-medium transition-all gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                All
              </TabsTrigger>
              <TabsTrigger
                value="competitor-ugc-replication"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-3 py-1.5 text-sm font-medium transition-all gap-2"
              >
                <Copy className="w-4 h-4" />
                Viral Clone
              </TabsTrigger>
              <TabsTrigger
                value="character"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-3 py-1.5 text-sm font-medium transition-all gap-2"
              >
                <User className="w-4 h-4" />
                Character
              </TabsTrigger>
              <TabsTrigger
                value="motion-swap"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-3 py-1.5 text-sm font-medium transition-all gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Motion Swap
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>

      {/* 4-column grid */}
      <div className="px-3 py-2">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-64 bg-muted rounded-xl animate-pulse border border-border"
              />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="text-center text-sm text-muted-foreground py-12">
            Failed to load content
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filtered.map((item) => {
            const hasWorkingImage =
              Boolean(item.coverImageUrl) &&
              !brokenImageIds.has(item.id) &&
              !isVideoLikeUrl(item.coverImageUrl);
            const fallbackToVideo = Boolean(item.videoUrl) && !hasWorkingImage;

            return (
              <div key={item.id} className="break-inside-avoid">
                <div
                  className="group relative w-full rounded-xl overflow-hidden border border-border/60 bg-muted hover:border-border transition-all duration-200"
                  onMouseEnter={() => item.videoUrl && handleMouseEnter(item.id)}
                  onMouseLeave={() => item.videoUrl && handleMouseLeave(item.id)}
                >
                  {fallbackToVideo ? (
                    <video
                      ref={(el) => setVideoRef(item.id, el)}
                      src={item.videoUrl}
                      className="w-full h-auto block"
                      playsInline
                      muted={audibleId !== item.id}
                      loop
                      preload="metadata"
                    />
                  ) : (
                    <>
                      {/* Cover image */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.coverImageUrl}
                        alt="ad"
                        loading="lazy"
                        className="w-full h-auto block"
                        onError={() => handleImageError(item.id)}
                      />

                      {/* Hover-playing video overlay (if present) */}
                      {item.videoUrl && (
                        <video
                          ref={(el) => setVideoRef(item.id, el)}
                          src={item.videoUrl}
                          className="absolute inset-0 w-full h-full object-cover"
                          playsInline
                          muted={audibleId !== item.id}
                          loop
                          preload="metadata"
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
