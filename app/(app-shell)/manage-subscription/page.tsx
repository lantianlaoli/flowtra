'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import FlowtraLoading from '@/components/ui/FlowtraLoading';

export default function ManageSubscriptionPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to account page where subscription info is displayed
    router.push('/dashboard/account');
  }, [router]);

  return <FlowtraLoading />;
}
