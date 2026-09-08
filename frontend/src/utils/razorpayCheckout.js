function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[data-violet-razorpay]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.violetRazorpay = '1';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({
  razorpay,
  order,
  user,
  onSuccess,
  onDismiss,
}) {
  const ready = await loadRazorpayScript();
  if (!ready || !window.Razorpay) {
    throw new Error('Could not load Razorpay Checkout');
  }

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: razorpay.keyId,
      amount: razorpay.amount,
      currency: razorpay.currency || 'INR',
      name: razorpay.name || 'Violet',
      description: razorpay.description || 'Order payment',
      order_id: razorpay.orderId,
      prefill: {
        name: user?.username || '',
        email: user?.email || '',
        contact: user?.phone_no || '',
      },
      theme: { color: '#3d2a4f' },
      handler(response) {
        Promise.resolve(onSuccess(response, order))
          .then(resolve)
          .catch(reject);
      },
      modal: {
        ondismiss() {
          if (onDismiss) onDismiss();
          reject(new Error('Payment cancelled'));
        },
      },
    });
    rzp.open();
  });
}
