'use client';

import { useUser } from '@clerk/nextjs';
import {
  BadgeCheck,
  BookOpen,
  BarChart3,
  Check,
  Clock,
  Coins,
  CreditCard,
  ExternalLink,
  GraduationCap,
  Home,
  Link2,
  Loader2,
  Mail,
  Minus,
  Moon,
  Palette,
  Plus,
  RotateCcw,
  Sparkles,
  Sun,
  Languages,
  TrendingUp,
  User,
  Zap,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useCredits } from '@/contexts/CreditsContext';
import { SITE_LOCALE_OPTIONS } from '@/lib/i18n/site';
import { cn } from '@/lib/utils';
import { useI18n } from '@/providers/I18nProvider';

interface SidebarUtilityDockProps {
  isDarkMode: boolean;
  onToggleDarkMode: (trigger: HTMLElement) => void;
  onNavigateTo: (href: string, onNavigate?: () => void) => void;
  onNavigate?: () => void;
}

type SettingsTab = 'profile' | 'appearance' | 'learning' | 'connected' | 'billing';

type TimeFilter = 'all' | 'today' | '7days' | '30days' | '90days';

type TikTokConnection = {
  display_name: string;
  avatar_url: string | null;
  connected_at: string;
  scope: string;
  tiktok_open_id: string;
};

type Subscription = {
  tier: 'lite' | 'basic' | 'pro';
  status: string;
  monthly_credits: number;
  credits_used_this_cycle: number;
  current_period_end: string;
};

type CreditTransaction = {
  id: string;
  type: 'purchase' | 'usage' | 'refund';
  amount: number;
  description: string;
  created_at: string;
};

type ActivityStats = {
  totalVideos: number;
  thisMonth: number;
  creditsUsed: number;
  hoursSaved: number;
};

type ParsedTransaction = {
  feature: string;
  action: 'generation' | 'download' | 'refund' | 'purchase' | 'other';
  userFriendlyModel?: string;
  duration?: string;
};

const modelNameMap: Record<string, string> = {
  seedance_2_fast: 'Seedance 2 Fast',
  seedance_2: 'Seedance 2',
  kling_3: 'Kling 3.0',
  'nano-banana-2': 'GPT Image 2',
  'gpt-image-2-image-to-image': 'GPT Image 2',
  'gpt-image-2-text-to-image': 'GPT Image 2',
};

const iconButtonClassName =
  'sidebar-utility-button inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-[#ECECE8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFCFB_100%)] text-[#444444] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_3px_0_rgba(232,232,228,0.98),0_10px_18px_rgba(15,23,42,0.035)] transition-all duration-150 hover:translate-y-[2px] hover:border-[#E7E7E2] hover:bg-[linear-gradient(180deg,#FDFDFC_0%,#F8F8F6_100%)] hover:text-[#111111] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_0_rgba(232,232,228,0.98),0_7px_12px_rgba(15,23,42,0.028)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_0px_0_rgba(232,232,228,0.98),0_4px_8px_rgba(15,23,42,0.022)]';

const tabs: Array<{ key: SettingsTab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'learning', label: 'Learning', icon: GraduationCap },
  { key: 'connected', label: 'Connected', icon: Link2 },
  { key: 'billing', label: 'Billing', icon: CreditCard },
];

const activityStatItems: Array<{
  key: keyof ActivityStats;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: 'totalVideos', label: 'Total videos', icon: BarChart3 },
  { key: 'thisMonth', label: 'This month', icon: TrendingUp },
  { key: 'creditsUsed', label: 'Credits used', icon: Zap },
  { key: 'hoursSaved', label: 'Hours saved', icon: Clock },
];

function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={cn('fill-current', className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function getDisplayName(user: ReturnType<typeof useUser>['user']) {
  return (
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'Flowtra user'
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTransactionDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseTransactionDescription(description: string): ParsedTransaction {
  const parts = description.split(' - ');
  const feature = (parts[0] || 'Unknown')
    .replace(/\s*\(step:\s*[^)]+\)/gi, '')
    .replace(/\s*step:\s*\S+/gi, '')
    .replace(/\s*\d+\s*scenes?/gi, '')
    .trim();
  const actionPart = (parts[1] || '')
    .replace(/\s*\(step:\s*[^)]+\)/gi, '')
    .replace(/\s*step:\s*\S+/gi, '')
    .replace(/\s*\d+\s*scenes?/gi, '')
    .trim();
  const modelOrDuration = actionPart.match(/\(([^)]+)\)/)?.[1]?.trim();
  const duration = actionPart.match(/(\d+)s/)?.[0] || (modelOrDuration?.match(/^\d+s$/) ? modelOrDuration : undefined);
  const model = modelOrDuration && !modelOrDuration.match(/^\d+s$/) ? modelOrDuration : undefined;

  let action: ParsedTransaction['action'] = 'other';
  if (actionPart.includes('generation')) action = 'generation';
  else if (actionPart.includes('Downloaded')) action = 'download';
  else if (actionPart.includes('Refund')) action = 'refund';
  else if (actionPart.includes('Purchase') || feature.includes('Purchase')) action = 'purchase';

  const normalizedModel = model?.toLowerCase();
  const userFriendlyModel = model
    ? (normalizedModel ? modelNameMap[normalizedModel] : undefined) ||
      model.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : undefined;

  return { feature, action, userFriendlyModel, duration };
}

function filterTransactionsByTime(transactions: CreditTransaction[], timeFilter: TimeFilter) {
  if (timeFilter === 'all') return transactions;

  const now = new Date();
  const startDate = new Date();
  switch (timeFilter) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case '7days':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30days':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90days':
      startDate.setDate(now.getDate() - 90);
      break;
  }

  return transactions.filter((transaction) => new Date(transaction.created_at) >= startDate);
}

export default function SidebarUtilityDock({
  isDarkMode,
  onToggleDarkMode,
  onNavigateTo,
  onNavigate,
}: SidebarUtilityDockProps) {
  const { user } = useUser();
  const { credits } = useCredits();
  const { locale, setLocale } = useI18n();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [activityStatsLoading, setActivityStatsLoading] = useState(false);
  const [tiktokConnection, setTiktokConnection] = useState<TikTokConnection | null>(null);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [unbindingTiktok, setUnbindingTiktok] = useState(false);
  const suppressNextClickRef = useRef(false);
  const selectedLocale = useMemo(
    () => SITE_LOCALE_OPTIONS.find((option) => option.value === locale) ?? SITE_LOCALE_OPTIONS[0],
    [locale],
  );
  const displayName = getDisplayName(user);
  const email = user?.primaryEmailAddress?.emailAddress || 'No email connected';
  const accountIdentifier =
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    user?.id ||
    'account';
  const filteredTransactions = useMemo(
    () => filterTransactionsByTime(transactions, timeFilter),
    [transactions, timeFilter],
  );
  const settingsTheme = isDarkMode
    ? {
        panel: 'border-[#252528] bg-[#111113] text-[#f4f4f5] shadow-[0_28px_90px_rgba(0,0,0,0.42)]',
        rail: 'border-[#242426] bg-[#09090b]',
        topBar: 'border-[#242426] bg-[#111113]/92',
        heading: 'text-white',
        closeButton: 'bg-[#242428] text-[#d4d4d8] hover:bg-[#303035] focus-visible:ring-white/40',
        tabBase: 'focus-visible:ring-white/35',
        tabActive: 'bg-[#252527] text-white',
        tabInactive: 'text-[#8e8e93] hover:bg-[#18181b] hover:text-[#f4f4f5]',
        sectionTitle: 'text-white',
        card: 'border-[#2a2a2d] bg-[#151517]',
        primaryText: 'text-white',
        secondaryText: 'text-[#9a9aa0]',
        eyebrowText: 'text-[#77777d]',
        avatarFallback: 'bg-[#252527]',
        avatarIcon: 'text-[#a1a1aa]',
        panelButton: 'border-[#2a2a2a] bg-[#0b0b0d] text-[#f4f4f5] hover:border-[#3a3a3d] hover:bg-[#171719]',
        languageActive: 'border-white bg-white text-black',
        languageInactive: 'border-[#2a2a2d] bg-[#151517] text-[#f4f4f5] hover:bg-[#1d1d20]',
        languageSubActive: 'text-black/60',
        languageSubInactive: 'text-[#8e8e93]',
        progressTrack: 'bg-[#252527]',
        progressBar: 'bg-white',
      }
    : {
        panel: 'border-[#E7E7E4] bg-white text-[#111111] shadow-[0_28px_80px_rgba(15,23,42,0.16)]',
        rail: 'border-[#E7E7E4] bg-[#F7F7F5]',
        topBar: 'border-[#E7E7E4] bg-white/92',
        heading: 'text-[#111111]',
        closeButton: 'bg-[#EFEFED] text-[#555555] hover:bg-[#E7E7E4] focus-visible:ring-black/30',
        tabBase: 'focus-visible:ring-black/25',
        tabActive: 'bg-white text-[#111111] shadow-[0_1px_2px_rgba(15,23,42,0.08)]',
        tabInactive: 'text-[#666666] hover:bg-white/70 hover:text-[#111111]',
        sectionTitle: 'text-[#111111]',
        card: 'border-[#E7E7E4] bg-[#FAFAF8]',
        primaryText: 'text-[#111111]',
        secondaryText: 'text-[#666666]',
        eyebrowText: 'text-[#777777]',
        avatarFallback: 'bg-[#EFEFED]',
        avatarIcon: 'text-[#777777]',
        panelButton: 'border-[#DCDCD8] bg-white text-[#111111] hover:border-[#CFCFCA] hover:bg-[#F7F7F5]',
        languageActive: 'border-[#111111] bg-[#111111] text-white',
        languageInactive: 'border-[#E2E2DE] bg-white text-[#111111] hover:bg-[#F7F7F5]',
        languageSubActive: 'text-white/70',
        languageSubInactive: 'text-[#666666]',
        progressTrack: 'bg-[#E8E8E4]',
        progressBar: 'bg-[#111111]',
      };
  const panelButtonClassName = cn(
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-[12px] border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
    settingsTheme.panelButton,
  );

  const fetchActivityStats = useCallback(async () => {
    setActivityStatsLoading(true);
    try {
      const response = await fetch('/api/user-stats', { cache: 'no-store' });
      const data = await response.json();
      setActivityStats(data?.success && data.stats ? data.stats : null);
    } catch (error) {
      console.error('Error fetching account activity stats:', error);
      setActivityStats(null);
    } finally {
      setActivityStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetchActivityStats();
  }, [fetchActivityStats, user?.id]);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isSettingsOpen || !user?.id) return;

    const fetchSubscription = async () => {
      setSubscriptionLoading(true);
      try {
        const response = await fetch('/api/subscription/status', { cache: 'no-store' });
        const data = await response.json();
        setSubscription(data?.success && data.subscription ? data.subscription : null);
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    const fetchTikTokConnection = async () => {
      setTiktokLoading(true);
      try {
        const response = await fetch('/api/tiktok/user/info', { cache: 'no-store' });
        const data = await response.json();
        setTiktokConnection(data?.connected ? data.connection : null);
      } catch (error) {
        console.error('Error fetching TikTok connection:', error);
        setTiktokConnection(null);
      } finally {
        setTiktokLoading(false);
      }
    };

    const fetchTransactions = async () => {
      setTransactionsLoading(true);
      try {
        const response = await fetch('/api/credits/transactions', { cache: 'no-store' });
        const data = await response.json();
        setTransactions(data?.success ? data.transactions || [] : []);
      } catch (error) {
        console.error('Error fetching credit transactions:', error);
        setTransactions([]);
      } finally {
        setTransactionsLoading(false);
      }
    };

    fetchSubscription();
    fetchTikTokConnection();
    fetchTransactions();
    fetchActivityStats();
  }, [fetchActivityStats, isSettingsOpen, user?.id]);

  const navigateAndClose = (href: string) => {
    setIsSettingsOpen(false);
    onNavigateTo(href, onNavigate);
  };

  const handleThemeClick = (event: MouseEvent<HTMLButtonElement>) => {
    onToggleDarkMode(event.currentTarget);
  };

  const handleOpenSettings = () => {
    setActiveTab('profile');
    setIsSettingsOpen((current) => !current);
  };

  const handlePointerActivate = (
    event: PointerEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    suppressNextClickRef.current = true;
    action();

    window.setTimeout(() => {
      suppressNextClickRef.current = false;
    }, 0);
  };

  const handleClickActivate = (
    event: MouseEvent<HTMLButtonElement>,
    action: (event: MouseEvent<HTMLButtonElement>) => void,
  ) => {
    if (suppressNextClickRef.current) {
      event.preventDefault();
      return;
    }

    action(event);
  };

  const handleManageBilling = async () => {
    setOpeningPortal(true);
    try {
      const response = await fetch('/api/subscription/portal', { method: 'POST' });
      const data = await response.json();
      if (data?.success && data.portal_url) {
        window.open(data.portal_url, '_blank');
      } else {
        window.alert('Failed to open billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      window.alert('Failed to open billing portal. Please try again.');
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleConnectTikTok = () => {
    window.location.href = '/api/tiktok/auth/authorize';
  };

  const handleDisconnectTikTok = async () => {
    if (!window.confirm('Are you sure you want to disconnect your TikTok account?')) return;

    setUnbindingTiktok(true);
    try {
      const response = await fetch('/api/tiktok/unbind', { method: 'POST' });
      const data = await response.json();
      if (data?.success) {
        setTiktokConnection(null);
      } else {
        window.alert('Failed to disconnect TikTok account');
      }
    } catch (error) {
      console.error('Error disconnecting TikTok:', error);
      window.alert('Failed to disconnect TikTok account');
    } finally {
      setUnbindingTiktok(false);
    }
  };

  return (
    <div className="relative bg-transparent">
      <div className="flex min-w-0 items-center gap-1.5 bg-transparent p-0">
        <button
          type="button"
          className={cn(
            'sidebar-utility-button inline-flex h-14 min-w-0 items-center gap-3 rounded-[20px] border border-[#ECECE8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFCFB_100%)] px-2.5 pr-3 text-left text-[#444444] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_3px_0_rgba(232,232,228,0.98),0_10px_18px_rgba(15,23,42,0.035)] transition-all duration-150 hover:translate-y-[2px] hover:border-[#E7E7E2] hover:bg-[linear-gradient(180deg,#FDFDFC_0%,#F8F8F6_100%)] hover:text-[#111111] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_0_rgba(232,232,228,0.98),0_7px_12px_rgba(15,23,42,0.028)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35 active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_0px_0_rgba(232,232,228,0.98),0_4px_8px_rgba(15,23,42,0.022)]',
            isSettingsOpen && (isDarkMode
              ? 'translate-y-[2px] border-[#111111] bg-[#111111] text-white'
              : 'translate-y-[2px] border-[#111111] bg-[#111111] text-white'),
          )}
          onPointerUp={(event) => handlePointerActivate(event, handleOpenSettings)}
          onClick={(event) => handleClickActivate(event, handleOpenSettings)}
          aria-label="Open account settings"
          aria-expanded={isSettingsOpen}
          aria-haspopup="dialog"
          title="Account settings"
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFEFED] text-sm font-semibold text-[#555555]">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block max-w-[8rem] truncate text-sm font-semibold leading-none">
              {displayName}
            </span>
            <span className="sidebar-utility-user-id mt-1 block max-w-[8rem] truncate text-xs text-[#777777]">
              @{accountIdentifier}
            </span>
          </span>
        </button>

        <button
          type="button"
          className={iconButtonClassName}
          onPointerUp={(event) => handlePointerActivate(event, () => onNavigateTo('/', onNavigate))}
          onClick={(event) => handleClickActivate(event, () => onNavigateTo('/', onNavigate))}
          aria-label="Back to landing"
          title="Back to landing"
        >
          <Home className="h-4.5 w-4.5" />
        </button>
      </div>

      {isSettingsOpen && typeof document !== 'undefined' ? createPortal((
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Account settings"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          className={cn(
            'fixed left-1/2 top-1/2 z-[120] h-[min(720px,calc(100vh-2rem))] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[24px] border',
            settingsTheme.panel,
          )}
        >
          <div className="flex h-full min-h-0 flex-col md:grid md:grid-cols-[178px_1fr]">
            <aside className={cn('border-b p-4 md:border-b-0 md:border-r', settingsTheme.rail)}>
              <div className="flex items-center justify-between md:block">
                <h2 className={cn('text-lg font-semibold tracking-tight', settingsTheme.heading)}>Settings</h2>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 md:hidden',
                    settingsTheme.closeButton,
                  )}
                  aria-label="Close settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="mt-4 flex gap-1.5 overflow-x-auto md:mt-7 md:flex-col md:overflow-visible" aria-label="Settings sections">
                {tabs.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 md:w-full',
                        settingsTheme.tabBase,
                        active ? settingsTheme.tabActive : settingsTheme.tabInactive,
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <section className="min-h-0 overflow-y-auto">
              <div className={cn('sticky top-0 z-10 hidden items-center justify-end border-b px-5 py-3 backdrop-blur md:flex', settingsTheme.topBar)}>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2',
                    settingsTheme.closeButton,
                  )}
                  aria-label="Close settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 md:p-6">
                {activeTab === 'profile' ? (
                  <div className="space-y-6">
                    <div>
                      <div className={cn('flex items-center gap-2 text-sm font-semibold', settingsTheme.sectionTitle)}>
                        <User className="h-4 w-4" />
                        <span>Account</span>
                      </div>
                      <div className={cn('mt-4 flex items-center gap-4 rounded-[14px] border p-4', settingsTheme.card)}>
                        {user?.imageUrl ? (
                          <img src={user.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover" />
                        ) : (
                          <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-full', settingsTheme.avatarFallback)}>
                            <User className={cn('h-7 w-7', settingsTheme.avatarIcon)} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className={cn('truncate text-base font-semibold', settingsTheme.primaryText)}>{displayName}</p>
                          <div className={cn('mt-1 flex min-w-0 items-center gap-1.5 text-sm', settingsTheme.secondaryText)}>
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{email}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className={cn('flex items-center gap-2 text-sm font-semibold', settingsTheme.sectionTitle)}>
                        <BarChart3 className="h-4 w-4" />
                        <span>Activity</span>
                      </div>
                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        {activityStatItems.map((item) => {
                          const Icon = item.icon;
                          const value = activityStats?.[item.key] ?? 0;

                          return (
                            <div key={item.key} className={cn('rounded-[14px] border p-3.5', settingsTheme.card)}>
                              <div className="flex items-start gap-3">
                                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', settingsTheme.avatarFallback)}>
                                  <Icon className={cn('h-4 w-4', settingsTheme.avatarIcon)} />
                                </span>
                                <div className="min-w-0">
                                  <p className={cn('truncate text-sm font-medium', settingsTheme.secondaryText)}>{item.label}</p>
                                  <p className={cn('mt-1 text-2xl font-semibold leading-none tabular-nums', settingsTheme.primaryText)}>
                                    {activityStatsLoading ? 'Loading...' : value.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className={cn('rounded-[14px] border p-4', settingsTheme.card)}>
                        <div className="flex items-center gap-3">
                          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', settingsTheme.avatarFallback)}>
                            <Coins className={cn('h-4 w-4', settingsTheme.avatarIcon)} />
                          </span>
                          <div>
                            <p className={cn('text-sm font-medium', settingsTheme.secondaryText)}>Credits</p>
                            <p className={cn('mt-1 text-2xl font-semibold leading-none tabular-nums', settingsTheme.primaryText)}>{(credits ?? 0).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className={cn('rounded-[14px] border p-4', settingsTheme.card)}>
                        <div className="flex items-center gap-3">
                          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', settingsTheme.avatarFallback)}>
                            <BadgeCheck className={cn('h-4 w-4', settingsTheme.avatarIcon)} />
                          </span>
                          <div>
                            <p className={cn('text-sm font-medium', settingsTheme.secondaryText)}>Plan</p>
                            <p className={cn('mt-1 text-base font-semibold capitalize', settingsTheme.primaryText)}>
                              {subscriptionLoading ? 'Loading...' : subscription?.tier || 'No active plan'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'appearance' ? (
                  <div className="space-y-6">
                    <div>
                      <div className={cn('flex items-center gap-2 text-sm font-semibold', settingsTheme.sectionTitle)}>
                        <Palette className="h-4 w-4" />
                        <span>Appearance</span>
                      </div>
                      <div className={cn('mt-4 rounded-[14px] border p-4', settingsTheme.card)}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', settingsTheme.avatarFallback)}>
                              {isDarkMode ? <Moon className={cn('h-4 w-4', settingsTheme.avatarIcon)} /> : <Sun className={cn('h-4 w-4', settingsTheme.avatarIcon)} />}
                            </span>
                            <div className="min-w-0">
                            <p className={cn('text-sm font-medium', settingsTheme.primaryText)}>Theme</p>
                            <p className={cn('mt-1 text-sm', settingsTheme.secondaryText)}>Switch dashboard surfaces between light and dark.</p>
                            </div>
                          </div>
                          <button type="button" onClick={handleThemeClick} className={panelButtonClassName}>
                            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            {isDarkMode ? 'Light' : 'Dark'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className={cn('flex items-center gap-2 text-sm font-semibold', settingsTheme.sectionTitle)}>
                        <Languages className="h-4 w-4" />
                        <span>Language</span>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {SITE_LOCALE_OPTIONS.map((option) => {
                          const active = option.value === selectedLocale.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setLocale(option.value)}
                              className={cn(
                                'flex min-h-11 items-center justify-between rounded-[12px] border px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                                settingsTheme.tabBase,
                                active ? settingsTheme.languageActive : settingsTheme.languageInactive,
                              )}
                            >
                              <span>
                                <span className="block text-sm font-medium">{option.label}</span>
                                <span className={cn('block text-xs', active ? settingsTheme.languageSubActive : settingsTheme.languageSubInactive)}>{option.nativeName}</span>
                              </span>
                              {active ? <Check className="h-4 w-4" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'learning' ? (
                  <div className="space-y-4">
                    <div className={cn('flex items-center gap-2 text-sm font-semibold', settingsTheme.sectionTitle)}>
                      <GraduationCap className="h-4 w-4" />
                      <span>Learning</span>
                    </div>
                    <div className={cn('rounded-[14px] border p-4', settingsTheme.card)}>
                      <div className="flex items-start gap-3">
                        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', settingsTheme.avatarFallback)}>
                          <BookOpen className={cn('h-4 w-4', settingsTheme.avatarIcon)} />
                        </span>
                        <div className="min-w-0">
                          <p className={cn('text-sm font-medium', settingsTheme.primaryText)}>Academy</p>
                          <p className={cn('mt-1 text-sm', settingsTheme.secondaryText)}>Open tutorials and workflow guides for the current product experience.</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => navigateAndClose('/academy')} className={cn(panelButtonClassName, 'mt-4')}>
                        <BookOpen className="h-4 w-4" />
                        Open Academy
                      </button>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'connected' ? (
                  <div className="space-y-4">
                    <div className={cn('flex items-center gap-2 text-sm font-semibold', settingsTheme.sectionTitle)}>
                      <Link2 className="h-4 w-4" />
                      <span>Connected Accounts</span>
                    </div>
                    <div className={cn('rounded-[14px] border p-4', settingsTheme.card)}>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                            <TikTokGlyph className="h-4.5 w-4.5" />
                          </span>
                          <div className="min-w-0">
                            <p className={cn('text-sm font-medium', settingsTheme.primaryText)}>TikTok</p>
                            <p className={cn('mt-1 text-sm', settingsTheme.secondaryText)}>
                              {tiktokLoading
                                ? 'Checking connection...'
                                : tiktokConnection
                                  ? `Connected as ${tiktokConnection.display_name}`
                                  : 'Connect TikTok to publish videos directly.'}
                            </p>
                          </div>
                        </div>
                        {tiktokLoading ? (
                          <Loader2 className={cn('h-4 w-4 animate-spin', settingsTheme.avatarIcon)} />
                        ) : tiktokConnection ? (
                          <button type="button" onClick={handleDisconnectTikTok} disabled={unbindingTiktok} className={panelButtonClassName}>
                            {unbindingTiktok ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                            {unbindingTiktok ? 'Disconnecting...' : 'Disconnect'}
                          </button>
                        ) : (
                          <button type="button" onClick={handleConnectTikTok} className={panelButtonClassName}>
                            <TikTokGlyph className="h-4 w-4" />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeTab === 'billing' ? (
                  <div className="space-y-4">
                    <div className={cn('flex items-center gap-2 text-sm font-semibold', settingsTheme.sectionTitle)}>
                      <CreditCard className="h-4 w-4" />
                      <span>Billing</span>
                    </div>
                    <div className={cn('rounded-[14px] border p-4', settingsTheme.card)}>
                      {subscriptionLoading ? (
                        <div className={cn('flex items-center gap-2 text-sm', settingsTheme.secondaryText)}>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading billing status...
                        </div>
                      ) : subscription ? (
                        <div className="space-y-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className={cn('text-base font-semibold capitalize', settingsTheme.primaryText)}>{subscription.tier} plan</p>
                                <span
                                  className={cn(
                                    'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-semibold capitalize',
                                    ['active', 'trialing'].includes(subscription.status)
                                      ? cn('border-emerald-500/30 bg-emerald-500/10', isDarkMode ? 'text-emerald-300' : 'text-emerald-700')
                                      : cn('border-amber-500/30 bg-amber-500/10', isDarkMode ? 'text-amber-300' : 'text-amber-700'),
                                  )}
                                >
                                  <Check className="h-3 w-3" />
                                  {['active', 'trialing'].includes(subscription.status) ? 'Subscribed' : subscription.status}
                                </span>
                              </div>
                              <p className={cn('mt-1 text-sm', settingsTheme.secondaryText)}>Renews or ends {formatDate(subscription.current_period_end)}</p>
                            </div>
                            <button type="button" onClick={handleManageBilling} disabled={openingPortal} className={panelButtonClassName}>
                              <ExternalLink className="h-4 w-4" />
                              {openingPortal ? 'Opening...' : 'Manage Billing'}
                            </button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className={cn('rounded-[12px] border p-3', isDarkMode ? 'border-[#2a2a2d] bg-[#101012]' : 'border-[#E7E7E4] bg-white')}>
                              <div className="flex items-center gap-2">
                                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', settingsTheme.avatarFallback)}>
                                  <Coins className={cn('h-4 w-4', settingsTheme.avatarIcon)} />
                                </span>
                                <div>
                                  <p className={cn('text-xs font-medium uppercase tracking-[0.12em]', settingsTheme.eyebrowText)}>Monthly credits</p>
                                  <p className={cn('text-base font-semibold tabular-nums', settingsTheme.primaryText)}>
                                    {subscription.monthly_credits.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className={cn('rounded-[12px] border p-3', isDarkMode ? 'border-[#2a2a2d] bg-[#101012]' : 'border-[#E7E7E4] bg-white')}>
                              <div className="flex items-center gap-2">
                                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', settingsTheme.avatarFallback)}>
                                  <CreditCard className={cn('h-4 w-4', settingsTheme.avatarIcon)} />
                                </span>
                                <div>
                                  <p className={cn('text-xs font-medium uppercase tracking-[0.12em]', settingsTheme.eyebrowText)}>Used this cycle</p>
                                  <p className={cn('text-base font-semibold tabular-nums', settingsTheme.primaryText)}>
                                    {subscription.credits_used_this_cycle.toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className={cn('mb-2 flex items-center justify-between text-xs', settingsTheme.secondaryText)}>
                              <span>Cycle usage</span>
                              <span>
                                {subscription.credits_used_this_cycle.toLocaleString()} / {subscription.monthly_credits.toLocaleString()}
                              </span>
                            </div>
                            <div className={cn('h-2 rounded-full', settingsTheme.progressTrack)}>
                              <div
                                className={cn('h-2 rounded-full', settingsTheme.progressBar)}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (subscription.credits_used_this_cycle / Math.max(1, subscription.monthly_credits)) * 100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', settingsTheme.avatarFallback)}>
                              <CreditCard className={cn('h-4 w-4', settingsTheme.avatarIcon)} />
                            </span>
                            <div className="min-w-0">
                              <p className={cn('text-sm font-medium', settingsTheme.primaryText)}>No active plan</p>
                              <p className={cn('mt-1 text-sm', settingsTheme.secondaryText)}>Choose a plan from pricing to add credits.</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => navigateAndClose('/#pricing')} className={panelButtonClassName}>
                            <ExternalLink className="h-4 w-4" />
                            View Pricing
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-2">
                          <Coins className={cn('mt-0.5 h-4 w-4 shrink-0', settingsTheme.avatarIcon)} />
                          <div className="min-w-0">
                            <p className={cn('text-sm font-semibold', settingsTheme.sectionTitle)}>Credit History</p>
                            <p className={cn('mt-1 text-xs', settingsTheme.secondaryText)}>Recent purchases, usage, and refunds.</p>
                          </div>
                        </div>
                        <select
                          value={timeFilter}
                          onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
                          className={cn(
                            'h-10 rounded-[12px] border px-3 text-sm font-medium outline-none transition-colors focus:ring-2',
                            settingsTheme.panelButton,
                            settingsTheme.tabBase,
                          )}
                        >
                          <option value="all">All Time</option>
                          <option value="today">Today</option>
                          <option value="7days">Last 7 Days</option>
                          <option value="30days">Last 30 Days</option>
                          <option value="90days">Last 90 Days</option>
                        </select>
                      </div>

                      <div className={cn('overflow-hidden rounded-[14px] border', settingsTheme.card)}>
                        {transactionsLoading ? (
                          <div className={cn('flex items-center gap-2 p-4 text-sm', settingsTheme.secondaryText)}>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading credit history...
                          </div>
                        ) : filteredTransactions.length === 0 ? (
                          <div className="p-6 text-center">
                            <Coins className={cn('mx-auto h-5 w-5', settingsTheme.avatarIcon)} />
                            <p className={cn('mt-2 text-sm font-medium', settingsTheme.primaryText)}>
                              {timeFilter === 'all' ? 'No transactions yet' : 'No transactions in this period'}
                            </p>
                            <p className={cn('mt-1 text-xs', settingsTheme.secondaryText)}>
                              {timeFilter === 'all'
                                ? 'Your credit transactions will appear here.'
                                : 'Try selecting a different time range.'}
                            </p>
                          </div>
                        ) : (
                          <div className="max-h-[260px] overflow-y-auto">
                            {filteredTransactions.map((transaction, index) => {
                              const parsed = parseTransactionDescription(transaction.description);
                              const positive = transaction.type === 'purchase' || transaction.type === 'refund';
                              const TransactionIcon = transaction.type === 'purchase'
                                ? Plus
                                : transaction.type === 'refund'
                                  ? RotateCcw
                                  : parsed.action === 'generation'
                                    ? Sparkles
                                    : Minus;

                              return (
                                <div
                                  key={transaction.id}
                                  className={cn(
                                    'flex items-center justify-between gap-4 px-4 py-3 transition-colors',
                                    index < filteredTransactions.length - 1 && 'border-b',
                                    isDarkMode ? 'border-[#2a2a2d] hover:bg-[#1d1d20]' : 'border-[#E7E7E4] hover:bg-white',
                                  )}
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', settingsTheme.avatarFallback)}>
                                      <TransactionIcon className={cn('h-4 w-4', settingsTheme.avatarIcon)} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                        <span className={cn('truncate text-sm font-medium', settingsTheme.primaryText)}>{parsed.feature}</span>
                                        {parsed.userFriendlyModel ? (
                                          <span className={cn('text-xs', settingsTheme.secondaryText)}>· {parsed.userFriendlyModel}</span>
                                        ) : null}
                                        {parsed.duration ? (
                                          <span className={cn('text-xs', settingsTheme.secondaryText)}>· {parsed.duration}</span>
                                        ) : null}
                                      </div>
                                      <p className={cn('mt-1 text-xs', settingsTheme.secondaryText)}>{formatTransactionDate(transaction.created_at)}</p>
                                    </div>
                                  </div>

                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <span className={cn('text-sm font-semibold tabular-nums', positive ? settingsTheme.primaryText : settingsTheme.secondaryText)}>
                                      {positive ? '+' : '-'}
                                      {Math.abs(transaction.amount).toLocaleString()}
                                    </span>
                                    <Coins className={cn('h-3.5 w-3.5', settingsTheme.avatarIcon)} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ), document.body) : null}
    </div>
  );
}
