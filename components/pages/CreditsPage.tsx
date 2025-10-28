'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { Coins, User, Link2, XCircle } from 'lucide-react';
import { HiPlus, HiMinus, HiLightningBolt, HiClipboardList } from 'react-icons/hi';

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

export default function CreditsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [tiktokConnection, setTiktokConnection] = useState<TikTokConnection | null>(null);
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [tiktokLoading, setTiktokLoading] = useState(true);
  const [unbindingTiktok, setUnbindingTiktok] = useState(false);

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

    fetchTransactions();
    fetchTikTokConnection();

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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
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

  // Parse transaction description to extract feature, stage, and model
  interface ParsedTransaction {
    feature: string;
    stage: string;
    model?: string;
  }

  const parseTransactionDescription = (desc: string): ParsedTransaction => {
    // Parse "Feature Name - Action (MODEL)" format
    const parts = desc.split(' - ');
    const feature = parts[0] || 'Unknown';
    const action = parts[1] || '';

    let stage = 'Other';
    if (action.includes('generation')) stage = 'Generation';
    else if (action.includes('Downloaded')) stage = 'Download';
    else if (action.includes('Refund')) stage = 'Refund';
    else if (action.includes('Purchase') || feature.includes('Purchase')) stage = 'Purchase';
    else if (action.includes('Remove') || action.includes('removal')) stage = 'Processing';
    else if (feature.includes('Initial')) stage = 'Welcome';

    // Extract model from parentheses
    const modelMatch = action.match(/\(([^)]+)\)/);
    const model = modelMatch ? modelMatch[1] : undefined;

    return { feature, stage, model };
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="md:ml-72 ml-0 bg-gray-50 min-h-screen pt-14 md:pt-0">
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Account
              </h1>
            </div>
          </div>

          {/* Statistics based on transaction history */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <HiPlus className="w-4 h-4 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Purchased</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {transactions
                      .filter(t => t.type === 'purchase')
                      .reduce((sum, t) => sum + t.amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <HiMinus className="w-4 h-4 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Used</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {transactions
                      .filter(t => t.type === 'usage')
                      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <HiLightningBolt className="w-4 h-4 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Refunded</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {transactions
                      .filter(t => t.type === 'refund')
                      .reduce((sum, t) => sum + t.amount, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Accounts Section */}
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 mb-6">Connected Accounts</h2>

            {/* TikTok Connection Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900">TikTok</h3>
                      {tiktokConnected && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                          Connected
                        </span>
                      )}
                    </div>

                    {tiktokLoading ? (
                      <p className="text-sm text-gray-600">Loading...</p>
                    ) : tiktokConnected && tiktokConnection ? (
                      <div className="flex items-center gap-2">
                        {tiktokConnection.avatar_url && (
                          <img
                            src={tiktokConnection.avatar_url}
                            alt={tiktokConnection.display_name}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <p className="text-sm text-gray-600">
                          Connected as <span className="font-medium text-gray-900">{tiktokConnection.display_name}</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">
                        Connect your TikTok account to publish videos directly
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  {tiktokConnected ? (
                    <button
                      onClick={handleDisconnectTikTok}
                      disabled={unbindingTiktok}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="w-4 h-4" />
                      {unbindingTiktok ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectTikTok}
                      disabled={tiktokLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            <h2 className="text-lg font-medium text-gray-900 mb-6">Transaction History</h2>
            
            {transactions.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg py-16 text-center">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <HiClipboardList className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions yet</h3>
                <p className="text-gray-600">Your credit transactions will appear here</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {transactions.map((transaction, index) => {
                  const parsed = parseTransactionDescription(transaction.description);

                  return (
                    <div
                      key={transaction.id}
                      className={`flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
                        index < transactions.length - 1 ? 'border-b border-gray-100' : ''
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          transaction.type === 'purchase' ? 'bg-green-100' :
                          transaction.type === 'refund' ? 'bg-orange-100' :
                          'bg-gray-100'
                        }`}>
                          {transaction.type === 'purchase' ? (
                            <HiPlus className="w-4 h-4 text-green-700" />
                          ) : transaction.type === 'usage' ? (
                            <HiMinus className="w-4 h-4 text-gray-700" />
                          ) : (
                            <HiLightningBolt className="w-4 h-4 text-orange-700" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {/* Feature Badge */}
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded whitespace-nowrap">
                              {parsed.feature}
                            </span>

                            {/* Stage Badge */}
                            <span className={`px-2 py-0.5 text-xs font-medium rounded whitespace-nowrap ${
                              parsed.stage === 'Generation' ? 'bg-green-100 text-green-700' :
                              parsed.stage === 'Download' ? 'bg-purple-100 text-purple-700' :
                              parsed.stage === 'Refund' ? 'bg-orange-100 text-orange-700' :
                              parsed.stage === 'Purchase' ? 'bg-emerald-100 text-emerald-700' :
                              parsed.stage === 'Welcome' ? 'bg-pink-100 text-pink-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {parsed.stage}
                            </span>

                            {/* Model Badge */}
                            {parsed.model && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded whitespace-nowrap">
                                {parsed.model}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{formatDate(transaction.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <span className={`text-sm font-semibold tabular-nums ${
                          transaction.type === 'purchase' || transaction.type === 'refund'
                            ? 'text-green-600'
                            : 'text-gray-900'
                        }`}>
                          {transaction.type === 'purchase' || transaction.type === 'refund' ? '+' : ''}
                          {Math.abs(transaction.amount).toLocaleString()}
                        </span>
                        <Coins className="w-3 h-3 text-gray-500" />
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
