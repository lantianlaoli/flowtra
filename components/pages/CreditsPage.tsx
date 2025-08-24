'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Sidebar from '@/components/layout/Sidebar';
import { Zap, CreditCard, Star, ArrowRight, History } from 'lucide-react';

interface CreditTransaction {
  id: string;
  type: 'purchase' | 'usage' | 'refund';
  amount: number;
  description: string;
  createdAt: string;
}

// Mock data - replace with actual API call
const mockTransactions: CreditTransaction[] = [
  {
    id: '1',
    type: 'purchase',
    amount: 2000,
    description: 'Starter Package Purchase',
    createdAt: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    type: 'usage',
    amount: -150,
    description: 'Video Generation (Veo3 High Quality)',
    createdAt: '2024-01-14T14:20:00Z'
  },
  {
    id: '3',
    type: 'usage',
    amount: -30,
    description: 'Video Generation (Veo3 Fast)',
    createdAt: '2024-01-13T09:15:00Z'
  }
];

const pricingPlans = [
  {
    name: 'Starter',
    price: 29,
    credits: 2000,
    veo3FastVideos: 65,
    veo3HighQualityVideos: 13,
    popular: false
  },
  {
    name: 'Pro',
    price: 99,
    credits: 7500,
    veo3FastVideos: 250,
    veo3HighQualityVideos: 50,
    popular: true
  }
];

export default function CreditsPage() {
  const { user, isLoaded } = useUser();
  const [userCredits, setUserCredits] = useState<number>();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      window.location.href = '/sign-in';
    }
  }, [isLoaded, user]);

  useEffect(() => {
    // TODO: Implement API calls
    setUserCredits(1820); // Mock current balance
    setTransactions(mockTransactions);
  }, []);

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

  const handlePurchase = (planName: string) => {
    setSelectedPlan(planName);
    // TODO: Implement payment processing
    console.log(`Purchasing plan: ${planName}`);
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
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar credits={userCredits} />
      
      <div className="flex-1">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Credits Management
            </h1>
            <p className="text-gray-600">
              Manage your credits, view transaction history, and purchase additional credits
            </p>
          </div>

          {/* Current Balance */}
          <div className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-8 h-8 text-yellow-500" />
                  <h2 className="text-2xl font-bold text-gray-900">Current Balance</h2>
                </div>
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {userCredits?.toLocaleString() || 0} <span className="text-xl text-gray-600">credits</span>
                </div>
                <p className="text-gray-600">
                  ≈ {Math.floor((userCredits || 0) / 30)} Veo3 Fast videos or {Math.floor((userCredits || 0) / 150)} Veo3 high-quality videos
                </p>
              </div>
              <div className="text-right">
                <button
                  onClick={() => document.getElementById('purchase-plans')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-gray-900 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <CreditCard className="w-5 h-5" />
                  Buy More Credits
                </button>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Purchased</p>
                  <p className="text-2xl font-bold text-gray-900">2,000</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Used</p>
                  <p className="text-2xl font-bold text-gray-900">180</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <History className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Ads Created</p>
                  <p className="text-2xl font-bold text-gray-900">3</p>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Plans */}
          <div id="purchase-plans" className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Purchase Additional Credits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`bg-white border-2 rounded-xl p-6 ${
                    plan.popular ? 'border-gray-900' : 'border-gray-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="flex items-center gap-1 mb-4">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium text-gray-900">Most Popular</span>
                    </div>
                  )}
                  
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name} Package</h3>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      ${plan.price} <span className="text-lg text-gray-600 font-normal">one-time</span>
                    </div>
                    <div className="text-2xl font-semibold text-gray-900 mb-2">
                      {plan.credits.toLocaleString()} Credits
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>≈ {plan.veo3FastVideos} Veo3 Fast videos</div>
                      <div>≈ {plan.veo3HighQualityVideos} Veo3 high-quality videos</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePurchase(plan.name)}
                    disabled={selectedPlan === plan.name}
                    className={`w-full py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      selectedPlan === plan.name
                        ? 'bg-green-600 text-white cursor-not-allowed'
                        : plan.popular
                        ? 'bg-gray-900 text-white hover:bg-gray-800'
                        : 'border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {selectedPlan === plan.name ? (
                      'Processing...'
                    ) : (
                      <>
                        Purchase {plan.name}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Transaction History</h2>
            
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h3>
                <p className="text-gray-600">Your credit transactions will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                        transaction.type === 'purchase' ? 'bg-green-100 text-green-600' :
                        transaction.type === 'usage' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {getTransactionIcon(transaction.type)}{Math.abs(transaction.amount)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{transaction.description}</p>
                        <p className="text-sm text-gray-600">{formatDate(transaction.createdAt)}</p>
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${getTransactionColor(transaction.type)}`}>
                      {transaction.type === 'usage' ? '' : '+'}{transaction.amount.toLocaleString()} credits
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