import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import AddressFields from '../components/AddressFields';
import { formatPrice } from '../components/ProductCard';
import { isValidPincode } from '../data/geoAddress';
import { openRazorpayCheckout } from '../utils/razorpayCheckout';
import { refreshCartBadge } from '../components/BottomNav';
import {
  formatCardExpiryInput,
  formatCardNumberInput,
  formatCvvInput,
} from '../utils/cardInput';

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

function hasAnyAddressField(address) {
  if (!address) return false;
  return Boolean(
    address.line1 ||
      address.line2 ||
      address.city ||
      address.state ||
      address.country ||
      address.pincode,
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
  { id: 'review', label: 'Order details' },
  { id: 'payment', label: 'Payment' },
];

function timeoutMinutesLabel(seconds) {
  const mins = Math.max(1, Math.round(Number(seconds || 120) / 60));
  return mins === 1 ? '1 minute' : `${mins} minutes`;
}

export default function CheckoutPage() {
  const { user, token, booting, updateLocalUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addressTouchedRef = useRef(false);
  const resumedPendingRef = useRef(false);
  const [step, setStep] = useState('address');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState('0.00');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingBlock, setPendingBlock] = useState(null);
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
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const profileAddress = user?.address || emptyAddress;
  const profileReady = hasProfileAddress(profileAddress);
  const upiTimeoutSeconds = Number(payConfig?.upiTimeoutSeconds) || 120;
  const upiTimeoutLabel = timeoutMinutesLabel(upiTimeoutSeconds);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [cartData, payment, me] = await Promise.all([
          api.getCart(token),
          api.paymentConfig(token).catch(() => null),
          api.me(token).catch(() => null),
        ]);
        if (cancelled) return;
        if (me?.user) updateLocalUser(me.user);
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
    // updateLocalUser is stable enough for a one-shot refresh; including it retriggers
    // loading forever when AuthContext recreates the callback after setUser.
  }, [token]);

  // Resume an in-progress UPI payment (Orders → Continue, or leaving checkout mid-timer).
  useEffect(() => {
    if (!token || loading || resumedPendingRef.current) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.pendingPayment(token);
        if (cancelled || !data?.pending) return;
        const order = data.pending;
        if (order.paymentMethod !== 'upi') return;
        resumedPendingRef.current = true;
        setPendingOrderId(order._id);
        setRemainingSeconds(
          Number(data.payment?.remainingSeconds) ||
            Number(payConfig?.upiTimeoutSeconds) ||
            120,
        );
        setReceipt({
          orderId: order._id,
          status: 'pending',
          method: 'upi',
          ref: data.payment?.ref || order.paymentRef,
          provider: data.payment?.provider || order.paymentProvider,
          detail: data.payment?.detail || order.paymentDetail,
          amount: order.total,
          expiresAt: data.payment?.expiresAt,
        });
        setPayPhase('awaiting_upi');
        setError('');
        setPendingBlock(null);
      } catch {
        /* form checkout still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loading, searchParams, payConfig?.upiTimeoutSeconds]);

  useEffect(() => {
    const defaultNote = user?.settings?.defaultCheckoutNote;
    if (defaultNote) setNote(defaultNote);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (addressTouchedRef.current) return;

    const fromProfile = user.address || emptyAddress;
    const useDefault = user.settings?.useProfileAddressAtCheckout !== false;

    if (useDefault && hasAnyAddressField(fromProfile)) {
      const seeded = { ...emptyAddress, ...fromProfile };
      setAddress(seeded);
      // Incomplete profile data stays in the form — never wipe to blank.
      setEditingAddress(!hasProfileAddress(seeded));
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
          setItems([]);
          setPayPhase('success');
          refreshCartBadge();
        } else if (status === 'failed') {
          setPayPhase('failed');
          setError(
            `Payment was not completed in time (${upiTimeoutLabel}). Your items are still in the cart.`,
          );
          refreshCartBadge();
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
  }, [payPhase, pendingOrderId, token, upiTimeoutLabel]);

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
          setItems([]);
          setPayPhase('success');
          refreshCartBadge();
        } else {
          setPayPhase('failed');
          setError(
            `Payment timed out after ${upiTimeoutLabel}. Your items are still in the cart.`,
          );
          refreshCartBadge();
        }
      } catch {
        if (!cancelled) {
          setPayPhase('failed');
          setError(
            `Payment timed out after ${upiTimeoutLabel}. Your items are still in the cart.`,
          );
          refreshCartBadge();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remainingSeconds, payPhase, pendingOrderId, token, upiTimeoutLabel]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  function patchAddress(updates) {
    addressTouchedRef.current = true;
    setAddress((prev) => ({ ...prev, ...updates }));
  }

  function startEditingAddress() {
    addressTouchedRef.current = true;
    setEditingAddress(true);
  }

  function applyProfileAddress() {
    const seeded = { ...emptyAddress, ...profileAddress };
    setAddress(seeded);
    setEditingAddress(!hasProfileAddress(seeded));
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

  async function applyCoupon(e) {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponBusy(true);
    setError('');
    try {
      const data = await api.validateCoupon(couponCode.trim(), total, token);
      setCouponDiscount({
        code: data.coupon?.code || couponCode.trim().toUpperCase(),
        discount: data.discount,
        total: data.total,
      });
      setCouponCode(data.coupon?.code || couponCode.trim().toUpperCase());
    } catch (err) {
      setCouponDiscount(null);
      setError(err.message || 'Invalid coupon');
    } finally {
      setCouponBusy(false);
    }
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
          couponCode: couponDiscount?.code || couponCode || undefined,
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
            refreshCartBadge();
          },
          onDismiss: () => {
            setPayPhase('form');
            setError(
              'Payment was cancelled. Your cart items are still there — try again when ready.',
            );
            refreshCartBadge();
          },
        });
        return;
      }

      if (data.action === 'awaiting_upi') {
        setPendingOrderId(data.order._id);
        setRemainingSeconds(
          Number(data.payment?.remainingSeconds) || upiTimeoutSeconds,
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
        // Keep cart until payment succeeds so a failed/cancelled pay still has items.
        refreshCartBadge();
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
      refreshCartBadge();
    } catch (err) {
      setPayPhase('form');
      const blockedId = err?.data?.orderId;
      if (blockedId) {
        setPendingBlock({
          orderId: blockedId,
          resumePath: err.data.resumePath || `/checkout?resume=${blockedId}`,
          remainingSeconds: err.data.payment?.remainingSeconds,
        });
        setError(
          err.message ||
            'You already have a payment in progress. Continue it from Orders or cancel it first.',
        );
      } else {
        setPendingBlock(null);
        setError(err.message || 'Payment failed');
      }
      refreshCartBadge();
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
      setError('Payment cancelled. Your items are still in the cart.');
      setPendingBlock(null);
      resumedPendingRef.current = false;
      refreshCartBadge();
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
    setPendingBlock(null);
    setPayPhase('form');
    setPendingOrderId('');
    setReceipt(null);
    setRemainingSeconds(0);
    resumedPendingRef.current = false;
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
                : 'Order placed'}
            </h3>
            <p className="lede">
              {receipt.status === 'pending' && receipt.method === 'cod'
                ? 'Pay the seller when your order arrives.'
                : 'Payment succeeded and your order is confirmed.'}
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
              <span className="payment-timer-hint">Expires in {upiTimeoutLabel}</span>
            </div>
            {error ? <p className="status error">{error}</p> : null}
            <p className="lede payment-resume-hint">
              Left this screen? You can always reopen this payment from{' '}
              <Link to="/orders">Orders</Link>.
            </p>
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
            <h3>Order failed</h3>
            <p className="lede">
              {error ||
                `The UPI payment was not completed within ${upiTimeoutLabel}. Your order was cancelled.`}
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
          <p>Confirm address, review order details, then pay.</p>
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
      {pendingBlock ? (
        <div className="payment-pending-banner" role="status">
          <div>
            <strong>Payment in progress</strong>
            <p>
              Finish or cancel it on Orders
              {typeof pendingBlock.remainingSeconds === 'number'
                ? ` (${Math.max(0, pendingBlock.remainingSeconds)}s left)`
                : ''}
              . Unfinished payments cancel automatically after {upiTimeoutLabel}.
            </p>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => {
                resumedPendingRef.current = false;
                api
                  .pendingPayment(token)
                  .then((data) => {
                    if (data?.pending) {
                      resumedPendingRef.current = true;
                      setPendingOrderId(data.pending._id);
                      setRemainingSeconds(
                        Number(data.payment?.remainingSeconds) || upiTimeoutSeconds,
                      );
                      setReceipt({
                        orderId: data.pending._id,
                        status: 'pending',
                        method: 'upi',
                        ref: data.payment?.ref || data.pending.paymentRef,
                        provider:
                          data.payment?.provider || data.pending.paymentProvider,
                        detail: data.payment?.detail || data.pending.paymentDetail,
                        amount: data.pending.total,
                        expiresAt: data.payment?.expiresAt,
                      });
                      setPayPhase('awaiting_upi');
                      setPendingBlock(null);
                      setError('');
                    } else {
                      navigate('/orders');
                    }
                  })
                  .catch(() => navigate('/orders'));
              }}
            >
              Continue payment
            </button>
            <Link className="btn btn-secondary" to="/orders">
              Open Orders
            </Link>
          </div>
        </div>
      ) : null}

      {step === 'address' ? (
        <form className="panel wide checkout-panel" onSubmit={continueFromAddress}>
          <h3>Shipping address</h3>
          {!editingAddress && addressComplete ? (
            <>
              <p className="lede">
                Using your saved profile address. Edits here apply to this order only.
              </p>
              <div className="checkout-address-selected">
                <div className="checkout-address-selected-main">
                  <span className="checkout-address-selected-badge" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <p className="checkout-address-selected-label">Selected address</p>
                    <p className="checkout-address-selected-text">{formatAddress(address)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="checkout-address-edit"
                  onClick={startEditingAddress}
                  aria-label="Edit address"
                  title="Edit address"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13.5 6.5l3 3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="form-actions">
                <button className="btn btn-accent" type="submit">
                  Continue to order details
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="lede">
                {profileReady
                  ? 'Update the shipping address for this order. It will not change your profile.'
                  : 'Add a shipping address to continue. It will not be saved to your profile unless you update Profile.'}
              </p>
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
                    onClick={applyProfileAddress}
                  >
                    Use profile address
                  </button>
                ) : null}
                {addressComplete && editingAddress ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditingAddress(false)}
                  >
                    Cancel
                  </button>
                ) : null}
                <button className="btn btn-accent" type="submit">
                  Continue to order details
                </button>
              </div>
            </>
          )}
        </form>
      ) : null}

      {step === 'review' ? (
        <form className="panel wide checkout-panel" onSubmit={continueFromReview}>
          <h3>Order details</h3>
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
                  startEditingAddress();
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

          <div className="coupon-row">
            <label className="visually-hidden" htmlFor="couponCode">
              Coupon code
            </label>
            <input
              id="couponCode"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value);
                setCouponDiscount(null);
              }}
              placeholder="Coupon code"
              autoComplete="off"
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={couponBusy || !couponCode.trim()}
              onClick={applyCoupon}
            >
              {couponBusy ? 'Checking…' : 'Apply'}
            </button>
          </div>
          {couponDiscount ? (
            <p className="status ok">
              Coupon {couponDiscount.code} applied · −{formatPrice(couponDiscount.discount)} · new
              total {formatPrice(couponDiscount.total)}
            </p>
          ) : null}

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
                  ? `Pay with UPI, Card, or Cash on delivery. UPI asks you to approve in your app within ${upiTimeoutLabel} — otherwise payment fails.`
                  : 'Pay securely with Razorpay Checkout, or choose Cash on delivery.'}
              </p>
              {payConfig?.razorpayEnabled || payConfig?.demo === false ? (
                <p className="payment-provider-note">
                  Online card/UPI may open Razorpay Checkout when configured on the server.
                </p>
              ) : null}

              <div className="coupon-row">
                <input
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    setCouponDiscount(null);
                  }}
                  placeholder="Coupon code"
                  autoComplete="off"
                  aria-label="Coupon code"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={couponBusy || !couponCode.trim()}
                  onClick={applyCoupon}
                >
                  {couponBusy ? 'Checking…' : 'Apply'}
                </button>
              </div>
              {couponDiscount ? (
                <p className="muted-link">
                  Discount {formatPrice(couponDiscount.discount)} with {couponDiscount.code}
                </p>
              ) : null}

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
                      onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                      placeholder="4111 1111 1111 1111"
                      maxLength={19}
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
                      inputMode="numeric"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatCardExpiryInput(e.target.value))}
                      placeholder="12/28"
                      maxLength={5}
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
                      onChange={(e) => setCardCvv(formatCvvInput(e.target.value))}
                      placeholder="123"
                      maxLength={3}
                      required
                      autoComplete="cc-csc"
                    />
                  </div>
                </div>
              ) : null}

              {paymentMethod === 'cod' ? (
                <div className="payment-cod-note">
                  <p>
                    Pay{' '}
                    <strong>
                      {formatPrice(couponDiscount?.total || total)}
                    </strong>{' '}
                    in cash when your order is delivered. No online charge now.
                  </p>
                </div>
              ) : null}

              <div className="checkout-pay-summary">
                <span>Amount due</span>
                <strong>{formatPrice(couponDiscount?.total || total)}</strong>
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
                    ? `Place order · ${formatPrice(couponDiscount?.total || total)}`
                    : `Pay ${formatPrice(couponDiscount?.total || total)}`}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
