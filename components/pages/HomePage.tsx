"use client";

import { useState, useEffect, type ComponentType } from "react";
import { useUser } from "@clerk/nextjs";
import { useCredits } from "@/contexts/CreditsContext";
import {
  Compass,
  LayoutGrid,
  Copy,
  User,
  RefreshCw,
  PlayCircle,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import DashboardContentTransition from "@/components/layout/DashboardContentTransition";
import { useRef, useMemo, useCallback } from "react";
import OnboardingProgress from "@/components/onboarding/OnboardingProgress";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FlowtraLoading from "@/components/ui/FlowtraLoading";
import { useI18n } from "@/providers/I18nProvider";

export default function HomePage() {
  const { messages } = useI18n();
  const homeMessages = messages.dashboard.home;
  const { user, isLoaded } = useUser();
  const { credits, creditsData } = useCredits();
  const [onboardingProgress, setOnboardingProgress] = useState<{
    hasImportedTiktok: boolean;
    hasProduct: boolean;
    hasAvatar: boolean;
    hasCreatedVideo: boolean;
    tasksCompleted: number;
    totalTasks: number;
  } | null>(null);

  // Fetch onboarding progress for the compact dashboard header.
  useEffect(() => {
    if (user) {
      fetchOnboardingProgress();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchOnboardingProgress = async () => {
    try {
      const response = await fetch("/api/user-stats");
      if (response.ok) {
        const data = await response.json();
        setOnboardingProgress(data.onboardingProgress || null);
      }
    } catch (error) {
      console.error("Failed to fetch onboarding progress:", error);
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

      <DashboardContentTransition className="dashboard-content-offset ml-0 bg-background min-h-screen">
        <div className="px-6 md:px-10 lg:px-12 pb-10 max-w-[1280px] mx-auto pt-6 md:pt-5">
          <div className="mb-4">
            <h1 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight mb-1.5">
              <span aria-hidden="true" className="mr-2">
                👋
              </span>
              {homeMessages.greetingPrefix}, {getUserName()}
            </h1>
            <p className="text-sm text-muted-foreground">
              {homeMessages.subtitle}
            </p>
          </div>

          {onboardingProgress && (
            <OnboardingProgress
              progress={onboardingProgress}
              className="mb-4"
            />
          )}

          {/* Discover Section - Pure media masonry grid */}
          <DiscoverSection />
        </div>
      </DashboardContentTransition>
    </div>
  );
}

// --- Discover Section --- //
type DiscoverType =
  | "all"
  | "video-clone"
  | "character"
  | "motion-clone";

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

const discoverTypeMeta: Record<Exclude<DiscoverType, "all">, { label: string; icon: ComponentType<{ className?: string }> }> = {
  "video-clone": { label: "Video Clone", icon: Copy },
  character: { label: "Character", icon: User },
  "motion-clone": { label: "Motion Clone", icon: RefreshCw },
};

function DiscoverSection() {
  const { messages } = useI18n();
  const discoverMessages = messages.dashboard.home.discover;
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
    <Card className="bg-card/95 border border-border/60 rounded-xl overflow-hidden shadow-[0_16px_44px_rgba(15,23,42,0.05)]">
      <div className="px-3 py-2 border-b border-border/60 md:px-4">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as DiscoverType)}
          className="w-full"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                <Compass className="w-4 h-4 text-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">
                {discoverMessages.title}
              </h2>
            </div>
            <TabsList className="bg-muted border border-border/60 rounded-lg p-0.5 h-auto shrink-0 self-start md:self-auto">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-2.5 py-1.5 text-xs font-medium transition-all gap-1.5"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {discoverMessages.all}
              </TabsTrigger>
              <TabsTrigger
                value="video-clone"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-2.5 py-1.5 text-xs font-medium transition-all gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {discoverMessages.viralClone}
              </TabsTrigger>
              <TabsTrigger
                value="character"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-2.5 py-1.5 text-xs font-medium transition-all gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                {discoverMessages.character}
              </TabsTrigger>
              <TabsTrigger
                value="motion-clone"
                className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md px-2.5 py-1.5 text-xs font-medium transition-all gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {discoverMessages.motionClone}
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
      </div>

      <div className="px-2.5 pb-2.5 pt-2 md:px-3">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] bg-muted rounded-xl animate-pulse border border-border"
              />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="text-center text-sm text-muted-foreground py-12">
            {discoverMessages.failedToLoad}
          </div>
        )}
        {!loading && !error && filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-lg font-semibold text-foreground">
              {discoverMessages.emptyTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {discoverMessages.emptyDescription}
            </p>
          </div>
        ) : (
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
                    className="group relative w-full aspect-[4/5] rounded-xl overflow-hidden border border-border/60 bg-muted shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_18px_42px_rgba(15,23,42,0.14)]"
                    onMouseEnter={() =>
                      item.videoUrl && handleMouseEnter(item.id)
                    }
                    onMouseLeave={() =>
                      item.videoUrl && handleMouseLeave(item.id)
                    }
                  >
                    {fallbackToVideo ? (
                      <video
                        ref={(el) => setVideoRef(item.id, el)}
                        src={item.videoUrl}
                        className="h-full w-full object-cover"
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
                          alt={`${discoverTypeMeta[item.type].label} example`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                          onError={() => handleImageError(item.id)}
                        />

                        {/* Hover-playing video overlay (if present) */}
                        {item.videoUrl && (
                          <video
                            ref={(el) => setVideoRef(item.id, el)}
                            src={item.videoUrl}
                            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            playsInline
                            muted={audibleId !== item.id}
                            loop
                            preload="metadata"
                            style={{ pointerEvents: "none" }}
                          />
                        )}
                      </>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/18 to-transparent opacity-85" />
                    <div className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-md">
                      {(() => {
                        const TypeIcon = discoverTypeMeta[item.type].icon;
                        return <TypeIcon className="h-3 w-3" />;
                      })()}
                      <span>{discoverTypeMeta[item.type].label}</span>
                    </div>
                    {item.videoUrl ? (
                      <div className="pointer-events-none absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white shadow-sm backdrop-blur-md">
                        <PlayCircle className="h-4 w-4" />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
