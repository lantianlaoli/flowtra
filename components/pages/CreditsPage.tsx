'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { Coins, Link2, XCircle, Sparkles, CreditCard, Calendar, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { HiPlus, HiMinus, HiLightningBolt, HiClipboardList } from 'react-icons/hi';
import FlowtraLoading from '@/components/ui/FlowtraLoading';

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
    'veo3': 'Veo 3',
    'veo3_fast': 'Veo 3 Fast',
    'sora2': 'Sora 2',
    'sora2_pro': 'Sora 2 Pro',
    'grok': 'Grok',
    'kling_2_6': 'Kling 2.6',
    'nano_banana': 'Nano Banana',
    'seedream': 'SeeDream',
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
    <div className="min-h-screen bg-white">
      <Sidebar
        credits={userCredits}
        creditsData={creditsData}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />

      <div className="md:ml-72 ml-0 bg-white min-h-screen ">
        <div className="px-6 md:px-8 pb-6 md:pb-8 max-w-[1280px] mx-auto pt-14 md:pt-8">
          <div className="mb-8 pb-6 border-b border-[#E5E5E5]">
            <h1 className="text-[40px] font-semibold tracking-tight text-[#000000]">
              Account
            </h1>
          </div>

          {/* Statistics based on transaction history */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col">
                <HiPlus className="w-6 h-6 text-[#000000] mb-3" />
                <p className="text-sm text-[#666666] font-medium mb-2">Total Purchased</p>
                <p className="text-3xl font-semibold text-[#000000] tracking-tight">
                  {transactions
                    .filter(t => t.type === 'purchase')
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col">
                <HiMinus className="w-6 h-6 text-[#000000] mb-3" />
                <p className="text-sm text-[#666666] font-medium mb-2">Total Used</p>
                <p className="text-3xl font-semibold text-[#000000] tracking-tight">
                  {transactions
                    .filter(t => t.type === 'usage')
                    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-[#F7F7F7] border border-[#E5E5E5] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col">
                <HiLightningBolt className="w-6 h-6 text-[#000000] mb-3" />
                <p className="text-sm text-[#666666] font-medium mb-2">Total Refunded</p>
                <p className="text-3xl font-semibold text-[#000000] tracking-tight">
                  {transactions
                    .filter(t => t.type === 'refund')
                    .reduce((sum, t) => sum + t.amount, 0)
                    .toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Subscription Management Section */}
          {!subscriptionLoading && subscription && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-[#000000] mb-6">Subscription</h2>

              <div className="bg-white border border-[#E5E5E5] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col gap-6">
                  {/* Header: Tier and Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center">
                        <CreditCard className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-[#000000] capitalize">{subscription.tier} Plan</h3>
                          {subscription.status === 'active' && (
                            <span className="px-2 py-1 bg-[#000000] text-white text-xs font-medium rounded">
                              Active
                            </span>
                          )}
                          {subscription.status === 'canceled' && (
                            <span className="px-2 py-1 bg-[#E5E5E5] text-[#666666] text-xs font-medium rounded">
                              Canceled
                            </span>
                          )}
                          {subscription.status === 'paused' && (
                            <span className="px-2 py-1 bg-[#FFA500] text-white text-xs font-medium rounded">
                              Paused
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#666666]">
                          {subscription.monthly_credits.toLocaleString()} credits per month
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleManageBilling}
                      disabled={openingPortal}
                      className="flex items-center gap-2 px-6 py-3 bg-[#000000] text-white text-sm font-medium rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {openingPortal ? 'Opening...' : 'Manage Billing'}
                    </button>
                  </div>

                  {/* Credits Usage Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[#666666]">Credits Used This Cycle</span>
                      <span className="text-sm font-semibold text-[#000000]">
                        {subscription.credits_used_this_cycle.toLocaleString()} / {subscription.monthly_credits.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-[#E5E5E5] rounded-full h-2">
                      <div
                        className="bg-[#000000] h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (subscription.credits_used_this_cycle / subscription.monthly_credits) * 100)}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Billing Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#E5E5E5]">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-[#666666] mt-0.5" />
                      <div>
                        <p className="text-xs text-[#666666] font-medium mb-1">Current Billing Period</p>
                        <p className="text-sm text-[#000000]">
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
                      <CheckCircle className="w-5 h-5 text-[#666666] mt-0.5" />
                      <div>
                        <p className="text-xs text-[#666666] font-medium mb-1">
                          {subscription.status === 'canceled' ? 'Subscription Ends' : 'Next Billing Date'}
                        </p>
                        <p className="text-sm text-[#000000]">
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
                    <div className="flex items-start gap-3 p-4 bg-[#F7F7F7] rounded-lg border border-[#E5E5E5]">
                      <AlertCircle className="w-5 h-5 text-[#666666] mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-[#000000] mb-1">Subscription Canceled</p>
                        <p className="text-xs text-[#666666]">
                          Your subscription was canceled on {new Date(subscription.canceled_at).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}. You'll continue to have access until {new Date(subscription.current_period_end).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Connected Accounts Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-[#000000] mb-6">Connected Accounts</h2>

            {/* TikTok Connection Card */}
            <div className="bg-white border border-[#E5E5E5] rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-[#000000] rounded-xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-[#000000]">TikTok</h3>
                      {tiktokConnected && (
                        <span className="px-2 py-1 bg-[#000000] text-white text-xs font-medium rounded">
                          Connected
                        </span>
                      )}
                    </div>

                    {tiktokLoading ? (
                      <p className="text-sm text-[#666666]">Loading...</p>
                    ) : tiktokConnected && tiktokConnection ? (
                      <div className="flex items-center gap-2">
                        {tiktokConnection.avatar_url && (
                          <Image
                            src={tiktokConnection.avatar_url}
                            alt={tiktokConnection.display_name}
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        )}
                        <p className="text-sm text-[#666666]">
                          Connected as <span className="font-medium text-[#000000]">{tiktokConnection.display_name}</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-[#666666]">
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
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-[#E5E5E5] text-[#000000] text-sm font-medium rounded-lg hover:bg-[#F7F7F7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" />
                      {unbindingTiktok ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectTikTok}
                      disabled={tiktokLoading}
                      className="flex items-center gap-2 px-6 py-3 bg-[#000000] text-white text-sm font-medium rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <h2 className="text-2xl font-semibold text-[#000000]">Transaction History</h2>

              {/* Time Filter */}
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as typeof timeFilter)}
                className="px-4 py-2 bg-white border border-[#E5E5E5] text-[#000000] text-sm font-medium rounded-lg hover:bg-[#F7F7F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#000000] focus:ring-offset-2"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="bg-[#F7F7F7] rounded-xl py-20 text-center">
                <div className="w-12 h-12 bg-[#E5E5E5] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <HiClipboardList className="w-6 h-6 text-[#666666]" />
                </div>
                <h3 className="text-xl font-semibold text-[#000000] mb-2">
                  {timeFilter === 'all' ? 'No transactions yet' : 'No transactions in this period'}
                </h3>
                <p className="text-[#666666]">
                  {timeFilter === 'all'
                    ? 'Your credit transactions will appear here'
                    : 'Try selecting a different time range'}
                </p>
              </div>
            ) : (
              <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                {filteredTransactions.map((transaction, index) => {
                  const parsed = parseTransactionDescription(transaction.description);

                  return (
                    <div
                      key={transaction.id}
                      className={`flex items-center justify-between px-6 py-4 hover:bg-[#F7F7F7] transition-colors ${
                        index < filteredTransactions.length - 1 ? 'border-b border-[#E5E5E5]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div>
                          {transaction.type === 'purchase' ? (
                            <HiPlus className="w-5 h-5 text-[#000000]" />
                          ) : transaction.type === 'refund' ? (
                            <HiLightningBolt className="w-5 h-5 text-[#000000]" />
                          ) : parsed.action === 'generation' ? (
                            <Sparkles className="w-5 h-5 text-[#000000]" />
                          ) : (
                            <HiMinus className="w-5 h-5 text-[#000000]" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {/* Feature Name */}
                            <span className="text-sm font-medium text-[#000000]">
                              {parsed.feature}
                            </span>

                            {/* Model (user-friendly) */}
                            {parsed.userFriendlyModel && (
                              <>
                                <span className="text-[#666666]">·</span>
                                <span className="text-sm text-[#666666]">
                                  {parsed.userFriendlyModel}
                                </span>
                              </>
                            )}

                            {/* Duration */}
                            {parsed.duration && (
                              <>
                                <span className="text-[#666666]">·</span>
                                <span className="text-sm text-[#666666]">
                                  {parsed.duration}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-[#666666]">{formatDate(transaction.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <span className={`text-sm font-semibold tabular-nums ${
                          transaction.type === 'purchase' || transaction.type === 'refund'
                            ? 'text-[#000000]'
                            : 'text-[#666666]'
                        }`}>
                          {transaction.type === 'purchase' || transaction.type === 'refund' ? '+' : ''}
                          {Math.abs(transaction.amount).toLocaleString()}
                        </span>
                        <Coins className="w-3.5 h-3.5 text-[#666666]" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
