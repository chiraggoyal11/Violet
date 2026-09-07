import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import AddressFields from '../components/AddressFields';
import { formatPrice } from '../components/ProductCard';
import { isValidPincode } from '../data/geoAddress';
import { openRazorpayCheckout } from '../utils/razorpayCheckout';

const emptyAddress = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
};

function hasProfileAddress(address) {
  if (!address) return false;
  return Boolean(
    address.line1 &&
      address.city &&
      address.state &&
      address.country &&
      isValidPincode(address.pincode),
  );
}

function formatAddress(address) {
  if (!address) return '';
  return [address.line1, address.line2, address.city, address.state, address.country, address.pincode]
    .filter(Boolean)
    .join(', ');
}

const STEPS = [
  { id: 'address', label: 'Address' },
  { id: 'review', label: 'Review' },
  { id: 'payment', label: 'Payment' },
];

export default function CheckoutPage() {
  const { user, token, booting } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('address');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState('0.00');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const [address, setAddress] = useState(emptyAddress);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [payConfig, setPayConfig] = useState(null);
  const [payPhase, setPayPhase] = useState('form'); // form | processing | awaiting_upi | success | failed
  const [receipt, setReceipt] = useState(null);
  const [pendingOrderId, setPendingOrderId] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const profileAddress = user?.address || emptyAddress;
  const useProfileDefault = user?.settings?.useProfileAddressAtCheckout !== false;
  const profileReady = hasProfileAddress(profileAddress);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [cartData, payment] = await Promise.all([
          api.getCart(token),
          api.paymentConfig(token).catch(() => null),
        ]);
        if (cancelled) return;
        setItems(cartData.items || []);
        setTotal(cartData.total || '0.00');
        if (payment?.payment) setPayConfig(payment.payment);
        if (!(cartData.items || []).length) {
          setError('Your cart is empty.');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load cart');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const defaultNote = user?.settings?.defaultCheckoutNote;
    if (defaultNote) setNote(defaultNote);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (useProfileDefault && profileReady) {
      setAddress({ ...emptyAddress, ...profileAddress });
      setEditingAddress(false);
    } else {
      setAddress(emptyAddress);
      setEditingAddress(true);
    }
  }, [user]);

  const addressComplete = useMemo(
    () =>
      Boolean(
        address.line1?.trim() &&
          address.city?.trim() &&
          address.state?.trim() &&
          address.country?.trim() &&
          isValidPincode(address.pincode),
      ),
    [address],
  );

  useEffect(() => {
    if (payPhase !== 'awaiting_upi' || !pendingOrderId || !token) return undefined;

    let cancelled = false;
    const tick = window.setInterval(() => {
      setRemainingSeconds((s) => Math.max(0, s - 1));
    }, 1000);

    const poll = window.setInterval(async () => {
      try {
        const data = await api.paymentStatus(pendingOrderId, token);
        if (cancelled) return;
        const status = data.payment?.status || data.order?.paymentStatus;
        if (typeof data.payment?.remainingSeconds === 'number') {
          setRemainingSeconds(data.payment.remainingSeconds);
        }
        if (status === 'paid') {
          setReceipt((prev) => ({
            ...prev,
            orderId: data.order._id,
            status: 'paid',
            method: data.order.paymentMethod,
            ref: data.payment?.ref || data.order.paymentRef,
            provider: data.payment?.provider || data.order.paymentProvider,
            detail: data.payment?.detail || data.order.paymentDetail,
            amount: data.order.total,
          }));
          setPayPhase('success');
        } else if (status === 'failed') {
          setPayPhase('failed');
          setError('Payment was not completed in time. Please try again.');
        }
      } catch {
        /* keep polling */
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [payPhase, pendingOrderId, token]);

  useEffect(() => {
    if (payPhase !== 'awaiting_upi' || remainingSeconds > 0 || !pendingOrderId || !token) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.paymentStatus(pendingOrderId, token);
        if (cancelled) return;
        if (data.payment?.status === 'paid') {
          setReceipt((prev) => ({
            ...prev,
            status: 'paid',
            ref: data.payment?.ref || data.order.paymentRef,
          }));
          setPayPhase('success');
        } else {
          setPayPhase('failed');
          setError('Payment timed out after 5 minutes. Order was cancelled.');
        }
      } catch {
        if (!cancelled) {
          setPayPhase('failed');
          setError('Payment timed out after 5 minutes. Order was cancelled.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remainingSeconds, payPhase, pendingOrderId, token]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  function patchAddress(updates) {
    setAddress((prev) => ({ ...prev, ...updates }));
  }

  function continueFromAddress(e) {
    e.preventDefault();
    setError('');
    if (!addressComplete) {
      setError(
        isValidPincode(address.pincode)
          ? 'Add a complete shipping address to continue.'
          : 'Pincode must be exactly 6 digits.',
      );
      setEditingAddress(true);
      return;
    }
    setEditingAddress(false);
    setStep('review');
  }

  function continueFromReview(e) {
    e.preventDefault();
    setError('');
    setStep('payment');
  }

  async function payAndPlaceOrder(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setPayPhase('processing');
    try {
      const paymentPayload =
        paymentMethod === 'upi'
          ? { upiId }
          : paymentMethod === 'card'
            ? { cardNumber, cardName, cardExpiry, cardCvv }
            : {};

      const data = await api.checkout(
        {
          note,
          shippingAddress: address,
          paymentMethod,
          payment: paymentPayload,
        },
        token,
      );

      if (data.action === 'razorpay' && data.razorpay) {
        await openRazorpayCheckout({
          razorpay: data.razorpay,
          order: data.order,
          user,
          onSuccess: async (response) => {
            const confirmed = await api.confirmPayment(
              data.order._id,
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              token,
            );
            setReceipt({
              orderId: confirmed.order._id,
              status: confirmed.payment?.status || 'paid',
              method: confirmed.order.paymentMethod,
              ref: confirmed.payment?.ref || confirmed.order.paymentRef,
              provider: 'razorpay',
              amount: confirmed.order.total,
            });
            setPayPhase('success');
            setItems([]);
          },
          onDismiss: () => {
            setPayPhase('form');
            setError('Payment was cancelled. Your order is pending — try again from Orders or checkout again.');
          },
        });
        return;
      }

      if (data.action === 'awaiting_upi') {
        setPendingOrderId(data.order._id);
        setRemainingSeconds(
          Number(data.payment?.remainingSeconds) ||
            Number(payConfig?.upiTimeoutSeconds) ||
            300,
        );
        setReceipt({
          orderId: data.order._id,
          status: 'pending',
          method: 'upi',
          ref: data.payment?.ref || data.order.paymentRef,
          provider: data.payment?.provider || data.order.paymentProvider,
          detail: data.payment?.detail || data.order.paymentDetail,
          amount: data.order.total,
          expiresAt: data.payment?.expiresAt,
        });
        setPayPhase('awaiting_upi');
        setItems([]);
        return;
      }

      setReceipt({
        orderId: data.order._id,
        status: data.payment?.status || data.order.paymentStatus,
        method: data.payment?.method || data.order.paymentMethod,
        ref: data.payment?.ref || data.order.paymentRef,
        provider: data.payment?.provider || data.order.paymentProvider,
        detail: data.payment?.detail || data.order.paymentDetail,
        amount: data.payment?.amount || data.order.total,
      });
      setPayPhase('success');
      setItems([]);
    } catch (err) {
      setPayPhase('form');
      setError(err.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  async function cancelUpiPayment() {
    if (!pendingOrderId) return;
    setBusy(true);
    try {
      await api.cancelPayment(pendingOrderId, token);
      setPayPhase('failed');
      setError('Payment cancelled. You can try again from cart.');
    } catch (err) {
      setError(err.message || 'Could not cancel payment');
    } finally {
      setBusy(false);
    }
  }

  function formatTimer(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function goToOrders() {
    if (receipt?.orderId && payPhase === 'success') {
      navigate(`/orders?placed=${receipt.orderId}`, { replace: true });
    } else {
      navigate('/orders', { replace: true });
    }
  }

  function retryPayment() {
    setError('');
    setPayPhase('form');
    setPendingOrderId('');
    setReceipt(null);
    setRemainingSeconds(0);
    navigate('/cart', { replace: true });
  }

  if (loading) {
    return (
      <section className="section">
        <p className="empty">Loading checkout…</p>
      </section>
    );
  }

  if (payPhase === 'success' && receipt) {
    return (
      <section className="section checkout-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Checkout</p>
            <h2>Complete your order</h2>
          </div>
        </div>
        <div className="panel wide checkout-panel">
          <div className="payment-success">
            <p className="section-kicker">Payment</p>
            <h3>
              {receipt.status === 'pending' && receipt.method === 'cod'
                ? 'Order placed'
                : 'Payment successful'}
            </h3>
            <p className="lede">
              {receipt.status === 'pending' && receipt.method === 'cod'
                ? 'Pay the seller when your order arrives.'
                : 'Your payment was received and the order is confirmed.'}
            </p>
            <dl className="payment-receipt">
              <div>
                <dt>Amount</dt>
                <dd>{formatPrice(receipt.amount)}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>{String(receipt.method || '').toUpperCase()}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{receipt.status}</dd>
              </div>
              {receipt.detail ? (
                <div>
                  <dt>Detail</dt>
                  <dd>{receipt.detail}</dd>
                </div>
              ) : null}
              {receipt.ref ? (
                <div>
                  <dt>Reference</dt>
                  <dd className="payment-ref">{receipt.ref}</dd>
                </div>
              ) : null}
              <div>
                <dt>Provider</dt>
                <dd>{receipt.provider}</dd>
              </div>
            </dl>
            <div className="form-actions">
              <button type="button" className="btn btn-accent" onClick={goToOrders}>
                View order
              </button>
              <Link className="btn btn-secondary" to="/catalog">
                Keep shopping
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (payPhase === 'awaiting_upi') {
    const urgent = remainingSeconds <= 60;
    return (
      <section className="section checkout-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Checkout</p>
            <h2>Complete your order</h2>
          </div>
        </div>
        <div className="panel wide checkout-panel">
          <div className="payment-awaiting-upi">
            <div className="payment-spinner" aria-hidden="true" />
            <h3>Waiting for UPI payment</h3>
            <p className="lede">
              Open your UPI app and approve the payment request for{' '}
              <strong>{formatPrice(receipt?.amount || total)}</strong>
              {receipt?.detail ? (
                <>
                  {' '}
                  from <strong>{receipt.detail}</strong>
                </>
              ) : null}
              . If you do not complete it in time, the payment will fail and the
              order will be cancelled.
            </p>
            <div
              className={`payment-timer${urgent ? ' urgent' : ''}`}
              role="timer"
              aria-live="polite"
              aria-label={`${remainingSeconds} seconds remaining`}
            >
              <span className="payment-timer-label">Time left</span>
              <strong className="payment-timer-value">{formatTimer(remainingSeconds)}</strong>
              <span className="payment-timer-hint">Expires in 5 minutes</span>
            </div>
            {error ? <p className="status error">{error}</p> : null}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelUpiPayment}
                disabled={busy}
              >
                Cancel payment
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (payPhase === 'failed') {
    return (
      <section className="section checkout-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Checkout</p>
            <h2>Complete your order</h2>
          </div>
        </div>
        <div className="panel wide checkout-panel">
          <div className="payment-failed">
            <h3>Payment failed</h3>
            <p className="lede">
              {error ||
                'The UPI payment was not completed within 5 minutes. Your order was cancelled.'}
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-accent" onClick={retryPayment}>
                Back to cart
              </button>
              <Link className="btn btn-secondary" to="/catalog">
                Keep shopping
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!items.length) {
    return (
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Checkout</p>
            <h2>Nothing to checkout</h2>
            <p>Add handmade finds to your cart first.</p>
          </div>
        </div>
        {error ? <p className="status error">{error}</p> : null}
        <Link className="btn btn-accent" to="/catalog">
          Browse shop
        </Link>
      </section>
    );
  }

  return (
    <section className="section checkout-section">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Checkout</p>
          <h2>Complete your order</h2>
          <p>Confirm shipping, review details, then pay securely.</p>
        </div>
        <Link className="btn btn-secondary" to="/cart">
          Back to cart
        </Link>
      </div>

      <ol className="checkout-steps" aria-label="Checkout steps">
        {STEPS.map((s, index) => {
          const current = STEPS.findIndex((x) => x.id === step);
          const done = index < current;
          const active = s.id === step;
          return (
            <li
              key={s.id}
              className={`checkout-step${active ? ' active' : ''}${done ? ' done' : ''}`}
            >
              <span className="checkout-step-num">{index + 1}</span>
              <span>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {error ? <p className="status error">{error}</p> : null}

      {step === 'address' ? (
        <form className="panel wide checkout-panel" onSubmit={continueFromAddress}>
          <h3>Ship to</h3>
          <p className="lede">
            {profileReady
              ? 'Your profile address is shown as the default. Editing here only applies to this order — it will not update your profile.'
              : 'Add a shipping address for this order. It will not be saved to your profile.'}
          </p>

          {!editingAddress && addressComplete ? (
            <div className="checkout-address-card">
              <p>{formatAddress(address)}</p>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingAddress(true)}
                >
                  Edit address
                </button>
                <button className="btn btn-accent" type="submit">
                  Use this address
                </button>
              </div>
            </div>
          ) : (
            <>
              <AddressFields
                address={address}
                onChange={patchAddress}
                autoCompletePrefix="shipping"
                required
              />
              <div className="form-actions">
                {profileReady ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setAddress({ ...emptyAddress, ...profileAddress });
                      setEditingAddress(false);
                    }}
                  >
                    Use profile address
                  </button>
                ) : null}
                <button className="btn btn-accent" type="submit">
                  Continue to review
                </button>
              </div>
            </>
          )}
        </form>
      ) : null}

      {step === 'review' ? (
        <form className="panel wide checkout-panel" onSubmit={continueFromReview}>
          <h3>Order review</h3>
          <p className="lede">Check products, total, and shipping before payment.</p>

          <div className="checkout-review-block">
            <h4>Items</h4>
            <ul className="checkout-item-list">
              {items.map((item) => (
                <li key={item.product_id}>
                  <span>
                    {item.quantity}× {item.product?.Product_Name || 'Item'}
                  </span>
                  <strong>
                    {formatPrice(
                      (Number(item.product?.Price) || 0) * Number(item.quantity || 0),
                    )}
                  </strong>
                </li>
              ))}
            </ul>
            <div className="checkout-total-row">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </div>
          </div>

          <div className="checkout-review-block">
            <div className="checkout-review-head">
              <h4>Shipping address</h4>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setEditingAddress(true);
                  setStep('address');
                }}
              >
                Edit
              </button>
            </div>
            <p>{formatAddress(address)}</p>
          </div>

          <div className="form-field">
            <label htmlFor="note">Order note (optional)</label>
            <textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Gift wrap, leave at door…"
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep('address')}
            >
              Back
            </button>
            <button className="btn btn-accent" type="submit">
              Continue to payment
            </button>
          </div>
        </form>
      ) : null}

      {step === 'payment' ? (
        <div className="panel wide checkout-panel">
          {payPhase === 'processing' ? (
            <div className="payment-processing" role="status" aria-live="polite">
              <div className="payment-spinner" aria-hidden="true" />
              <h3>Processing payment</h3>
              <p className="lede">
                Securely confirming your {paymentMethod.toUpperCase()} payment…
              </p>
            </div>
          ) : null}

          {payPhase === 'form' ? (
            <form onSubmit={payAndPlaceOrder}>
              <h3>Payment</h3>
              <p className="lede">
                {payConfig?.demo !== false
                  ? 'Pay with UPI, Card, or Cash on delivery. UPI asks you to approve in your app within 5 minutes — otherwise payment fails.'
                  : 'Pay securely with Razorpay Checkout, or choose Cash on delivery.'}
              </p>

              <div className="payment-method-tabs payment-method-tabs-3" role="tablist" aria-label="Payment method">
                <button
                  type="button"
                  role="tab"
                  aria-selected={paymentMethod === 'upi'}
                  className={paymentMethod === 'upi' ? 'active' : ''}
                  onClick={() => setPaymentMethod('upi')}
                >
                  UPI
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={paymentMethod === 'card'}
                  className={paymentMethod === 'card' ? 'active' : ''}
                  onClick={() => setPaymentMethod('card')}
                >
                  Card
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={paymentMethod === 'cod'}
                  className={paymentMethod === 'cod' ? 'active' : ''}
                  onClick={() => setPaymentMethod('cod')}
                >
                  COD
                </button>
              </div>

              {paymentMethod === 'upi' ? (
                <div className="form-field">
                  <label htmlFor="upiId">UPI ID</label>
                  <input
                    id="upiId"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="name@upi"
                    required
                    autoComplete="off"
                  />
                </div>
              ) : null}

              {paymentMethod === 'card' ? (
                <div className="form-grid">
                  <div className="form-field form-field-full">
                    <label htmlFor="cardNumber">Card number</label>
                    <input
                      id="cardNumber"
                      inputMode="numeric"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4111 1111 1111 1111"
                      required
                      autoComplete="cc-number"
                    />
                  </div>
                  <div className="form-field form-field-full">
                    <label htmlFor="cardName">Name on card</label>
                    <input
                      id="cardName"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      required
                      autoComplete="cc-name"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="cardExpiry">Expiry (MM/YY)</label>
                    <input
                      id="cardExpiry"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="12/28"
                      required
                      autoComplete="cc-exp"
                    />
                  </div>
                  <div className="form-field">
                    <label htmlFor="cardCvv">CVV</label>
                    <input
                      id="cardCvv"
                      inputMode="numeric"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="123"
                      required
                      autoComplete="cc-csc"
                    />
                  </div>
                </div>
              ) : null}

              {paymentMethod === 'cod' ? (
                <div className="payment-cod-note">
                  <p>
                    Pay <strong>{formatPrice(total)}</strong> in cash when your order is
                    delivered. No online charge now.
                  </p>
                </div>
              ) : null}

              <div className="checkout-pay-summary">
                <span>Amount due</span>
                <strong>{formatPrice(total)}</strong>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setStep('review')}
                  disabled={busy}
                >
                  Back
                </button>
                <button className="btn btn-accent" type="submit" disabled={busy}>
                  {paymentMethod === 'cod'
                    ? `Place order · ${formatPrice(total)}`
                    : `Pay ${formatPrice(total)}`}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
