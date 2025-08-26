'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { Zap, CreditCard, ArrowRight, History } from 'lucide-react';
import { HiStar, HiLightningBolt, HiCreditCard, HiTrendingUp, HiClipboardList, HiCheck, HiPlus, HiMinus } from 'react-icons/hi';
import { handleCreemCheckout } from '@/lib/payment';

interface CreditTransaction {
  id: string;
  type: 'purchase' | 'usage' | 'refund';
  amount: number;
  description: string;
  created_at: string;
}

// This will be replaced with actual API data

const pricingPlans = [
  {
    name: 'Starter',
    price: 29,
    credits: 2000,
    veo3FastVideos: 65,
    veo3HighQualityVideos: 13,
    popular: true
  },
  {
    name: 'Pro',
    price: 99,
    credits: 7500,
    veo3FastVideos: 250,
    veo3HighQualityVideos: 50,
    popular: false
  }
];

export default function CreditsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    
    fetchTransactions();
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

  const handlePurchase = async (planName: string) => {
    if (!user?.primaryEmailAddress?.emailAddress) {
      setErrorMessage('Please log in before purchasing');
      return;
    }

    setErrorMessage(null);
    setSelectedPlan(planName);

    const packageName = planName.toLowerCase() as 'starter' | 'pro';

    await handleCreemCheckout({
      packageName,
      userEmail: user.primaryEmailAddress.emailAddress,
      onLoading: setIsLoading,
      onError: (error) => {
        setErrorMessage(error);
        setSelectedPlan(null);
      }
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'text-green-600';
      case 'usage':
        return 'text-red-600';
      case 'refund':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return '+';
      case 'usage':
        return '';
      case 'refund':
        return '+';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        credits={userCredits}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="ml-64 bg-white min-h-screen">
        <div className="p-12 max-w-6xl mx-auto">
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <HiLightningBolt className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Credits
              </h1>
            </div>
            <p className="text-gray-500 text-base max-w-2xl">
              Manage your credit balance and view your usage history
            </p>
          </div>

          {/* Current Balance - Notion style */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                    <HiLightningBolt className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-lg font-medium text-gray-900">Current Balance</h2>
                </div>
                <div className="text-3xl font-semibold text-gray-900 mb-3">
                  {userCredits?.toLocaleString() || 0}
                  <span className="text-base text-gray-500 font-normal ml-2">credits</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>≈ {Math.floor((userCredits || 0) / 30)} Fast videos</p>
                  <p>≈ {Math.floor((userCredits || 0) / 150)} High-quality videos</p>
                </div>
              </div>
              <div>
                <button
                  onClick={() => document.getElementById('purchase-plans')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  <HiCreditCard className="w-4 h-4" />
                  Purchase
                </button>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <HiTrendingUp className="w-4 h-4 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Purchased</p>
                  <p className="text-xl font-semibold text-gray-900">0</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <HiLightningBolt className="w-4 h-4 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Used</p>
                  <p className="text-xl font-semibold text-gray-900">0</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <HiClipboardList className="w-4 h-4 text-gray-700" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ads Created</p>
                  <p className="text-xl font-semibold text-gray-900">0</p>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Plans */}
          <div id="purchase-plans" className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Purchase Additional Credits</h2>
            
            {/* Error message */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
                {errorMessage}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`bg-white border rounded-lg p-6 transition-colors hover:bg-gray-50 flex flex-col h-full ${
                    plan.popular ? 'border-gray-400' : 'border-gray-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center">
                        <HiStar className="w-2.5 h-2.5 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-900">Most Popular</span>
                    </div>
                  )}
                  
                  <div className="flex-1 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{plan.name} Package</h3>
                    <div className="mb-4">
                      <span className="text-2xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-sm text-gray-600 ml-2">one-time</span>
                    </div>
                    <div className="text-lg font-semibold text-gray-900 mb-3">
                      {plan.credits.toLocaleString()} Credits
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>≈ {plan.veo3FastVideos} Veo3 Fast videos</div>
                      <div>≈ {plan.veo3HighQualityVideos} Veo3 high-quality videos</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(plan.name)}
                    disabled={selectedPlan === plan.name || isLoading}
                    className={`w-full py-2.5 px-4 rounded-md font-medium transition-colors text-sm flex items-center justify-center gap-2 mt-auto ${
                      selectedPlan === plan.name || isLoading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : plan.popular
                        ? 'bg-black text-white hover:bg-gray-800'
                        : 'border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {(selectedPlan === plan.name || isLoading) ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </div>
                    ) : (
                      <>
                        Purchase {plan.name}
                        <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction History - Notion style */}
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-6">Recent Activity</h2>
            
            {transactions.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg py-16 text-center">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <HiClipboardList className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No activity yet</h3>
                <p className="text-gray-600">Your credit transactions will appear here</p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {transactions.map((transaction, index) => (
                  <div 
                    key={transaction.id} 
                    className={`flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
                      index < transactions.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        transaction.type === 'purchase' 
                          ? 'bg-green-100' 
                          : transaction.type === 'usage' 
                          ? 'bg-red-100' 
                          : 'bg-blue-100'
                      }`}>
                        {transaction.type === 'purchase' ? (
                          <HiPlus className="w-4 h-4 text-green-600" />
                        ) : transaction.type === 'usage' ? (
                          <HiMinus className="w-4 h-4 text-red-600" />
                        ) : (
                          <HiLightningBolt className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-1">{transaction.description}</p>
                        <p className="text-xs text-gray-500">{formatDate(transaction.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${
                        transaction.type === 'purchase' 
                          ? 'text-green-700' 
                          : 'text-gray-900'
                      }`}>
                        {transaction.type === 'purchase' ? '+' : ''}
                        {transaction.amount.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500">credits</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}