export interface PaymentOptions {
  packageName: 'lite' | 'basic' | 'pro';
  userEmail: string;
  onLoading?: (isLoading: boolean) => void;
  onError?: (error: string) => void;
}

export async function handleCreemCheckout({ 
  packageName, 
  userEmail, 
  onLoading, 
  onError 
}: PaymentOptions): Promise<void> {
  if (!userEmail) {
    onError?.('Please log in before purchasing a package');
    return;
  }

  onLoading?.(true);

  try {
    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        packageName,
        userEmail
      })
    });

    const data = await response.json();

    if (data.success && data.checkout_url) {
      // Redirect to Creem checkout page
      window.location.href = data.checkout_url;
    } else {
      throw new Error(data.error || 'Failed to create checkout');
    }
  } catch (error) {
    console.error('Purchase error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Purchase failed, please try again later';
    onError?.(errorMessage);
  } finally {
    onLoading?.(false);
  }
}
