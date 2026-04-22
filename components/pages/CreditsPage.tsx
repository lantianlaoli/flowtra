'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import DashboardContentTransition from '@/components/layout/DashboardContentTransition';
import { Coins, Link2, XCircle, Sparkles, CreditCard, Calendar, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { HiPlus, HiMinus, HiLightningBolt, HiClipboardList } from 'react-icons/hi';
import FlowtraLoading from '@/components/ui/FlowtraLoading';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/client';

interface CreditTransaction {
  id: string;
  type: 'purchase' | 'usage' | 'refund';
  amount: number;
  description: string;
  created_at: string;
}

interface TikTokConnection {
  display_name: string;
  avatar_url: string | null;
  connected_at: string;
  scope: string;
  tiktok_open_id: string;
}

interface Subscription {
  id: string;
  tier: 'lite' | 'basic' | 'pro';
  status: string;
  monthly_credits: number;
  credits_used_this_cycle: number;
  current_period_start: string;
  current_period_end: string;
  subscribed_at: string;
  canceled_at?: string;
}

export default function CreditsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits, creditsData } = useCredits();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [tiktokConnection, setTiktokConnection] = useState<TikTokConnection | null>(null);
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [tiktokLoading, setTiktokLoading] = useState(true);
  const [unbindingTiktok, setUnbindingTiktok] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | '7days' | '30days' | '90days'>('all');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, user]);

  useEffect(() => {
    if (!user?.id) return;
    trackEvent(ANALYTICS_EVENTS.credits_page_viewed, {
      feature: 'account',
      surface: 'credits_page',
    });
    trackEvent(ANALYTICS_EVENTS.subscription_status_viewed, {
      feature: 'billing',
      surface: 'credits_page',
    });
  }, [user?.id]);

  useEffect(() => {
    // Credits are now managed by CreditsContext

    // Fetch user transactions
    const fetchTransactions = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch('/api/credits/transactions');
        const data = await response.json();

        if (data.success) {
          setTransactions(data.transactions);
        } else {
          console.error('Failed to fetch transactions:', data.error);
          setTransactions([]);
        }
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setTransactions([]);
      }
    };

    // Fetch TikTok connection info
    const fetchTikTokConnection = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch('/api/tiktok/user/info');
        const data = await response.json();

        if (data.connected) {
          setTiktokConnected(true);
          setTiktokConnection(data.connection);
        } else {
          setTiktokConnected(false);
          setTiktokConnection(null);
        }
      } catch (error) {
        console.error('Error fetching TikTok connection:', error);
      } finally {
        setTiktokLoading(false);
      }
    };

    // Fetch subscription info
    const fetchSubscription = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch('/api/subscription/status');
        const data = await response.json();

        if (data.success && data.subscription) {
          setSubscription(data.subscription);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    fetchTransactions();
    fetchTikTokConnection();
    fetchSubscription();

    // Handle OAuth callback status messages
    const params = new URLSearchParams(window.location.search);
    if (params.get('tiktok_success') === 'true') {
      // Refresh TikTok connection data
      fetchTikTokConnection();
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/account');
    }
    if (params.get('tiktok_error')) {
      const error = params.get('tiktok_error');
      console.error('TikTok connection error:', error);
      alert(`Failed to connect TikTok: ${error}`);
      // Clean URL
      window.history.replaceState({}, '', '/dashboard/account');
    }
  }, [user?.id]);

  // Loading state
  if (!isLoaded) {
    return <FlowtraLoading />;
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Model name mapping: technical name → user-friendly name
  const modelNameMap: Record<string, string> = {
    'seedance_2_fast': 'Seedance 2 Fast',
    'seedance_2': 'Seedance 2',
    'kling_3': 'Kling 3.0',
    'nano-banana-2': 'GPT Image 2',
    'gpt-image-2-image-to-image': 'GPT Image 2',
    'gpt-image-2-text-to-image': 'GPT Image 2',
  };

  // Parse transaction description to extract feature, action, model, and duration
  interface ParsedTransaction {
    feature: string;
    action: 'generation' | 'download' | 'refund' | 'purchase' | 'other';
    model?: string;
    userFriendlyModel?: string;
    duration?: string;
  }

  // Filter transactions by time range
  const filterTransactionsByTime = (transactions: CreditTransaction[]) => {
    if (timeFilter === 'all') {
      return transactions;
    }

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

    return transactions.filter(t => new Date(t.created_at) >= startDate);
  };

  const filteredTransactions = filterTransactionsByTime(transactions);

  const parseTransactionDescription = (desc: string): ParsedTransaction => {
    // Parse "Feature Name - Action (MODEL)" or "Feature Name - Action (DURATION)" format
    let parts = desc.split(' - ');
    let feature = parts[0] || 'Unknown';
    let actionPart = parts[1] || '';

    // Clean up feature name - remove technical step names
    feature = feature
      .replace(/\s*\(step:\s*[^)]+\)/gi, '') // Remove (step: check_videos_status)
      .replace(/\s*step:\s*\S+/gi, '') // Remove step: check_videos_status
      .replace(/\s*\d+\s*scenes?/gi, '') // Remove "1 scene", "2 scenes"
      .trim();

    // Clean up action part - remove technical details
    actionPart = actionPart
      .replace(/\s*\(step:\s*[^)]+\)/gi, '') // Remove (step: ...)
      .replace(/\s*step:\s*\S+/gi, '') // Remove step: ...
      .replace(/\s*\d+\s*scenes?/gi, '') // Remove scene counts
      .trim();

    // Determine action type
    let action: ParsedTransaction['action'] = 'other';
    if (actionPart.includes('generation')) action = 'generation';
    else if (actionPart.includes('Downloaded')) action = 'download';
    else if (actionPart.includes('Refund')) action = 'refund';
    else if (actionPart.includes('Purchase') || feature.includes('Purchase')) action = 'purchase';

    // Extract model from parentheses
    const modelMatch = actionPart.match(/\(([^)]+)\)/);
    const modelOrDuration = modelMatch ? modelMatch[1] : undefined;

    // Check if it's a model name or duration
    let model: string | undefined;
    let duration: string | undefined;
    let userFriendlyModel: string | undefined;

    if (modelOrDuration) {
      // Clean up model name - remove underscores and normalize
      const cleanedModel = modelOrDuration.trim();

      // If it contains 's' at the end, it's likely a duration (e.g., "10s", "8s")
      if (cleanedModel.match(/^\d+s$/)) {
        duration = cleanedModel;
      } else {
        model = cleanedModel;
        // Map technical model name to user-friendly name
        userFriendlyModel = modelNameMap[cleanedModel] || cleanedModel;

        // If no mapping found, try to beautify the name
        if (!modelNameMap[cleanedModel]) {
          userFriendlyModel = cleanedModel
            .replace(/_/g, ' ') // Replace underscores with spaces
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
            .join(' ');
        }
      }
    }

    // Extract duration from action text (e.g., "10s generation")
    const durationMatch = actionPart.match(/(\d+)s/);
    if (durationMatch && !duration) {
      duration = `${durationMatch[1]}s`;
    }

    return { feature, action, model, userFriendlyModel, duration };
  };

  // Handle TikTok connection
  const handleConnectTikTok = () => {
    trackEvent(ANALYTICS_EVENTS.tiktok_connect_started, {
      feature: 'tiktok',
      surface: 'credits_page',
    });
    window.location.href = '/api/tiktok/auth/authorize';
  };

  // Handle TikTok disconnection
  const handleDisconnectTikTok = async () => {
    if (!confirm('Are you sure you want to disconnect your TikTok account?')) {
      return;
    }

    setUnbindingTiktok(true);
    try {
      const response = await fetch('/api/tiktok/unbind', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setTiktokConnected(false);
        setTiktokConnection(null);
        trackEvent(ANALYTICS_EVENTS.tiktok_unbound, {
          feature: 'tiktok',
          surface: 'credits_page',
        });
        alert('TikTok account disconnected successfully');
      } else {
        alert('Failed to disconnect TikTok account');
      }
    } catch (error) {
      console.error('Error disconnecting TikTok:', error);
      alert('Failed to disconnect TikTok account');
    } finally {
      setUnbindingTiktok(false);
    }
  };

  // Handle manage billing (open Creem customer portal)
  const handleManageBilling = async () => {
    setOpeningPortal(true);
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success && data.portal_url) {
        trackEvent(ANALYTICS_EVENTS.subscription_portal_opened, {
          feature: 'billing',
          surface: 'credits_page',
        });
        window.open(data.portal_url, '_blank');
      } else {
        alert('Failed to open billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Error opening billing portal:', error);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setOpeningPortal(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        credits={userCredits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <DashboardContentTransition className="dashboard-content-offset ml-0 bg-background min-h-screen ">
        <div className="px-6 md:px-8 pb-6 md:pb-8 max-w-[1280px] mx-auto pt-14 md:pt-8">
          <div className="mb-8 pb-6 border-b border-border">
            <h1 className="text-[40px] font-semibold tracking-tight text-foreground">
              Account
            </h1>
          </div>

          {/* Statistics based on transaction history */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-muted border border-border rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col">
                <HiPlus className="w-6 h-6 text-foreground mb-3" />
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Purchased</p>
                <p className="text-3xl font-semibold text-foreground tracking-tight">
                  {transactions
                    .filter(t => t.type === 'purchase')
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-muted border border-border rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col">
                <HiMinus className="w-6 h-6 text-foreground mb-3" />
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Used</p>
                <p className="text-3xl font-semibold text-foreground tracking-tight">
                  {transactions
                    .filter(t => t.type === 'usage')
                    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-muted border border-border rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col">
                <HiLightningBolt className="w-6 h-6 text-foreground mb-3" />
                <p className="text-sm text-muted-foreground font-medium mb-2">Total Refunded</p>
                <p className="text-3xl font-semibold text-foreground tracking-tight">
                  {transactions
                    .filter(t => t.type === 'refund')
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Credits Breakdown */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Credits Balance</h2>

            <div className="bg-card border border-border rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground font-medium mb-1">Total Credits</p>
                  <p className="text-4xl font-bold text-foreground tracking-tight">
                    {(userCredits ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
                  <Coins className="w-8 h-8 text-primary-foreground" />
                </div>
              </div>

              {/* Credits Breakdown */}
              {(creditsData?.subscription_credits || creditsData?.purchased_credits) && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Breakdown</p>

                  {(creditsData?.subscription_credits ?? 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-blue-950/40 border border-blue-900/40 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Subscription Credits</p>
                          <p className="text-xs text-muted-foreground">From your active subscription plan</p>
                        </div>
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        {(creditsData?.subscription_credits ?? 0).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {(creditsData?.purchased_credits ?? 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Purchased Credits</p>
                          <p className="text-xs text-muted-foreground">
                            From one-time purchases before subscription system. These credits never expire.
                          </p>
                        </div>
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        {(creditsData?.purchased_credits ?? 0).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Subscription Management Section */}
          {!subscriptionLoading && subscription && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">Subscription</h2>

              <div className="bg-card border border-border rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                <div className="flex flex-col gap-6">
                  {/* Header: Tier and Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
                        <CreditCard className="w-7 h-7 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-foreground capitalize">{subscription.tier} Plan</h3>
                          {subscription.status === 'active' && (
                            <span className="px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded">
                              Active
                            </span>
                          )}
                          {subscription.status === 'trialing' && (
                            <>
                              {(() => {
                                // Defensive check: Is trial actually expired?
                                const isExpired = subscription.current_period_end &&
                                  new Date() > new Date(subscription.current_period_end);

                                if (isExpired) {
                                  return (
                                    <>
                                      <span className="px-2 py-1 bg-red-600 text-white text-xs font-medium rounded">
                                        Trial Expired
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        Ended: {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric'
                                        })}
                                      </span>
                                    </>
                                  );
                                }

                                return (
                                  <>
                                    <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded">
                                      Trial
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Ends: {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </span>
                                  </>
                                );
                              })()}
                            </>
                          )}
                          {subscription.status === 'canceled' && (
                            <span className="px-2 py-1 bg-border text-muted-foreground text-xs font-medium rounded">
                              Canceled
                            </span>
                          )}
                          {subscription.status === 'paused' && (
                            <span className="px-2 py-1 bg-[#FFA500] text-white text-xs font-medium rounded">
                              Paused
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {subscription.monthly_credits.toLocaleString()} credits per month
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleManageBilling}
                      disabled={openingPortal}
                      className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {openingPortal ? 'Opening...' : 'Manage Billing'}
                    </button>
                  </div>

                  {/* Credits Usage Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Credits Used This Cycle</span>
                      <span className="text-sm font-semibold text-foreground">
                        {subscription.credits_used_this_cycle.toLocaleString()} / {subscription.monthly_credits.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-border rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (subscription.credits_used_this_cycle / subscription.monthly_credits) * 100)}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Billing Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Current Billing Period</p>
                        <p className="text-sm text-foreground">
                          {new Date(subscription.current_period_start).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                          {' - '}
                          {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">
                          {subscription.status === 'canceled' ? 'Subscription Ends' : 'Next Billing Date'}
                        </p>
                        <p className="text-sm text-foreground">
                          {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Canceled Notice */}
                  {subscription.status === 'canceled' && subscription.canceled_at && (
                    <div className="flex items-start gap-3 p-4 bg-muted rounded-lg border border-border">
                      <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground mb-1">Subscription Canceled</p>
                        <p className="text-xs text-muted-foreground">
                          Your subscription was canceled on {new Date(subscription.canceled_at).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}. You&apos;ll continue to have access until {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Trial Notice */}
                  {subscription.status === 'trialing' && (() => {
                    const isExpired = subscription.current_period_end &&
                      new Date() > new Date(subscription.current_period_end);

                    if (isExpired) {
                      return (
                        <div className="flex items-start gap-3 p-4 bg-red-950/40 rounded-lg border border-red-900/40">
                          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-foreground mb-1">Trial Expired</p>
                            <p className="text-xs text-muted-foreground">
                              Your trial ended on {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })}. Please update your payment method to continue using your subscription.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex items-start gap-3 p-4 bg-blue-950/40 rounded-lg border border-blue-900/40">
                        <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground mb-1">Trial Active</p>
                          <p className="text-xs text-muted-foreground">
                            You have full access to {subscription.monthly_credits.toLocaleString()} credits during your trial.
                            Your trial ends on {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric'
                            })}. Unused credits will remain after trial ends (no reset).
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Connected Accounts Section */}
          <div className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">Connected Accounts</h2>

              {/* TikTok Connection Card */}
              <div className="bg-card border border-border rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-primary-foreground" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                      </svg>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-foreground">TikTok</h3>
                        {tiktokConnected && (
                          <span className="px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded">
                            Connected
                          </span>
                        )}
                      </div>

                      {tiktokLoading ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      ) : tiktokConnected && tiktokConnection ? (
                        <div className="flex items-center gap-2">
                          {tiktokConnection!.avatar_url && (
                            <Image
                              src={tiktokConnection!.avatar_url!}
                              alt={tiktokConnection!.display_name || 'TikTok User'}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-full object-cover"
                            />
                          )}
                          <p className="text-sm text-muted-foreground">
                            Connected as <span className="font-medium text-foreground">{tiktokConnection!.display_name}</span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Connect your TikTok account to publish videos directly
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {tiktokConnected ? (
                      <button
                        onClick={handleDisconnectTikTok}
                        disabled={unbindingTiktok}
                        className="flex items-center gap-2 px-6 py-3 bg-background border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle className="w-4 h-4" />
                        {unbindingTiktok ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        onClick={handleConnectTikTok}
                        disabled={tiktokLoading}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Link2 className="w-4 h-4" />
                        Connect TikTok
                      </button>
                    )}

                  </div>
                </div>
              </div>
            </div>

          {/* Transaction History */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-foreground">Transaction History</h2>

              {/* Time Filter */}
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
                className="px-4 py-2 bg-background border border-border text-foreground text-sm font-medium rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-foreground focus:ring-offset-background"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="bg-muted rounded-xl py-20 text-center">
                <div className="w-12 h-12 bg-border rounded-xl flex items-center justify-center mx-auto mb-4">
                  <HiClipboardList className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  {timeFilter === 'all' ? 'No transactions yet' : 'No transactions in this period'}
                </h3>
                <p className="text-muted-foreground">
                  {timeFilter === 'all'
                    ? 'Your credit transactions will appear here'
                    : 'Try selecting a different time range'}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                {filteredTransactions.map((transaction, index) => {
                  const parsed = parseTransactionDescription(transaction.description);

                  return (
                    <div
                      key={transaction.id}
                      className={`flex items-center justify-between px-6 py-4 hover:bg-muted transition-colors ${
                        index < filteredTransactions.length - 1 ? 'border-b border-border' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div>
                          {transaction.type === 'purchase' ? (
                            <HiPlus className="w-5 h-5 text-foreground" />
                          ) : transaction.type === 'refund' ? (
                            <HiLightningBolt className="w-5 h-5 text-foreground" />
                          ) : parsed.action === 'generation' ? (
                            <Sparkles className="w-5 h-5 text-foreground" />
                          ) : (
                            <HiMinus className="w-5 h-5 text-foreground" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {/* Feature Name */}
                            <span className="text-sm font-medium text-foreground">
                              {parsed.feature}
                            </span>

                            {/* Model (user-friendly) */}
                            {parsed.userFriendlyModel && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-sm text-muted-foreground">
                                  {parsed.userFriendlyModel}
                                </span>
                              </>
                            )}

                            {/* Duration */}
                            {parsed.duration && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-sm text-muted-foreground">
                                  {parsed.duration}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <span className={`text-sm font-semibold tabular-nums ${
                          transaction.type === 'purchase' || transaction.type === 'refund'
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        }`}>
                          {transaction.type === 'purchase' || transaction.type === 'refund' ? '+' : ''}
                          {Math.abs(transaction.amount).toLocaleString()}
                        </span>
                        <Coins className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DashboardContentTransition>
    </div>
  );
}
