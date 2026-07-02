export interface PaymentOptions {
  packageName: 'lite' | 'plus' | 'basic' | 'pro';
  userEmail: string;
  isSubscription?: boolean; // Whether to create a subscription checkout (default: false)
  onLoading?: (isLoading: boolean) => void;
  onError?: (error: string) => void;
}

export async function handleCreemCheckout({
  packageName,
  userEmail,
  isSubscription = false, // Default to one-time purchase
  onLoading,
  onError
}: PaymentOptions): Promise<void> {
  console.log('🛒 Starting Creem checkout process', { packageName, userEmail });

  if (!userEmail) {
    console.log('❌ No user email provided');
    onError?.('Please log in before purchasing a package');
    return;
  }

  onLoading?.(true);

  try {
    console.log('📡 Sending checkout request to API...');

    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        packageName,
        userEmail,
        isSubscription
      })
    });

    console.log(`📡 API response status: ${response.status}`);

    if (!response.ok) {
      console.log(`❌ HTTP error: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📄 API response data:', data);

    if (data.success && data.checkout_url) {
      console.log(`🔗 Redirecting to checkout URL: ${data.checkout_url}`);
      // Redirect to Creem checkout page
      window.location.href = data.checkout_url;
    } else {
      console.log('❌ Checkout creation failed:', data);
      throw new Error(data.error || data.details || 'Failed to create checkout');
    }
  } catch (error) {
    console.error('❌ Purchase error:', error);

    // More detailed error logging
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('🌐 Network error - check internet connection');
    } else if (error instanceof Error) {
      console.error('🔍 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }

    const errorMessage = error instanceof Error
      ? error.message
      : 'Purchase failed, please try again later';

    onError?.(errorMessage);
  } finally {
    console.log('🔄 Setting loading state to false');
    onLoading?.(false);
  }
}
