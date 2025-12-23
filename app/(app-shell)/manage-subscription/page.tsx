'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CreditCard, Calendar, Activity, ExternalLink } from 'lucide-react';
import FlowtraLoading from '@/components/ui/FlowtraLoading';

interface Subscription {
  id: string;
  tier: string;
  status: string;
  monthly_credits: number;
  credits_used_this_cycle: number;
  current_period_start: string;
  current_period_end: string;
  creem_customer_id: string;
}

export default function ManageSubscriptionPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/subscription/status');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch subscription');
      }

      if (!data.subscription) {
        // No subscription found - redirect to pricing
        router.push('/pricing');
        return;
      }

      setSubscription(data.subscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal link');
      }

      // Redirect to Creem customer portal
      window.location.href = data.portal_url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  if (loading) {
    return <FlowtraLoading />;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return null; // Will redirect to pricing
  }

  const creditsRemaining = subscription.monthly_credits - subscription.credits_used_this_cycle;
  const usagePercentage = Math.round((subscription.credits_used_this_cycle / subscription.monthly_credits) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manage Subscription</h1>
        <p className="text-gray-600 mt-2">View and manage your subscription details</p>
      </div>

      {/* Subscription Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        {/* Plan Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 capitalize">{subscription.tier} Plan</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                subscription.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {subscription.status}
              </span>
            </div>
          </div>

          <button
            onClick={handleManageBilling}
            disabled={portalLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {portalLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Manage Billing</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Credits Usage */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Monthly Credits</span>
            <span className="text-sm font-medium text-gray-900">
              {creditsRemaining.toLocaleString()} / {subscription.monthly_credits.toLocaleString()}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${usagePercentage}%` }}
            />
          </div>

          <p className="text-xs text-gray-500 mt-2">
            {subscription.credits_used_this_cycle.toLocaleString()} credits used this cycle ({usagePercentage}%)
          </p>
        </div>

        {/* Billing Cycle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Current Period</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(subscription.current_period_start).toLocaleDateString()} - {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <Activity className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Next Billing Date</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
              <p className="text-xs text-blue-600 mt-1 font-medium">
                Credits will reset to {subscription.monthly_credits.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-medium">Note:</span> Your credits reset to {subscription.monthly_credits.toLocaleString()} at the start of each billing cycle. Unused credits do not carry over.
          </p>
        </div>
      </div>
    </div>
  );
}
