'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useCredits } from '@/contexts/CreditsContext';
import Sidebar from '@/components/layout/Sidebar';
import { Coins } from 'lucide-react';
import { HiPlus, HiMinus, HiLightningBolt, HiClipboardList } from 'react-icons/hi';

interface CreditTransaction {
  id: string;
  type: 'purchase' | 'usage' | 'refund';
  amount: number;
  description: string;
  created_at: string;
}

export default function CreditsPage() {
  const { user, isLoaded } = useUser();
  const { credits: userCredits } = useCredits();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [selectedModel, setSelectedModel] = useState<'auto' | 'veo3' | 'veo3_fast'>('auto');

  const handleModelChange = (model: 'auto' | 'veo3' | 'veo3_fast') => {
    setSelectedModel(model);
  };

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        credits={userCredits}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        userEmail={user?.primaryEmailAddress?.emailAddress}
        userImageUrl={user?.imageUrl}
      />
      
      <div className="ml-64 bg-gray-50 min-h-screen">
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <HiLightningBolt className="w-4 h-4 text-gray-700" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Credits
              </h1>
            </div>
            <p className="text-gray-500 text-base max-w-2xl">
              View your credit transaction history
            </p>
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
                {transactions.map((transaction, index) => (
                  <div 
                    key={transaction.id} 
                    className={`flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors ${
                      index < transactions.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100`}>
                        {transaction.type === 'purchase' ? (
                          <HiPlus className="w-4 h-4 text-gray-700" />
                        ) : transaction.type === 'usage' ? (
                          <HiMinus className="w-4 h-4 text-gray-700" />
                        ) : (
                          <HiLightningBolt className="w-4 h-4 text-gray-700" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 mb-1">{transaction.description}</p>
                        <p className="text-xs text-gray-500">{formatDate(transaction.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold text-gray-900 tabular-nums`}>
                        {Math.abs(transaction.amount).toLocaleString()}
                      </span>
                      <Coins className="w-3 h-3 text-gray-500" />
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