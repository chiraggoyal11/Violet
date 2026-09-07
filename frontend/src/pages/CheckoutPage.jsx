import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { formatPrice } from '../components/ProductCard';

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
    address.line1 && address.city && address.state && address.country && address.pincode,
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
        const data = await api.getCart(token);
        if (cancelled) return;
        setItems(data.items || []);
        setTotal(data.total || '0.00');
        if (!(data.items || []).length) {
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
          address.pincode?.trim(),
      ),
    [address],
  );

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  function setAddressField(key, value) {
    setAddress((prev) => ({ ...prev, [key]: value }));
  }

  function continueFromAddress(e) {
    e.preventDefault();
    setError('');
    if (!addressComplete) {
      setError('Add a complete shipping address to continue.');
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
    try {
      const data = await api.checkout(
        {
          note,
          shippingAddress: address,
          paymentMethod,
          payment:
            paymentMethod === 'upi'
              ? { upiId }
              : { cardNumber, cardName, cardExpiry, cardCvv },
        },
        token,
      );
      navigate(`/orders?placed=${data.order._id}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="section">
        <p className="empty">Loading checkout…</p>
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
          <p>Confirm shipping, review details, then pay with Card or UPI.</p>
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
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label htmlFor="line1">Address line 1</label>
                  <input
                    id="line1"
                    value={address.line1}
                    onChange={(e) => setAddressField('line1', e.target.value)}
                    required
                    autoComplete="shipping address-line1"
                  />
                </div>
                <div className="form-field form-field-full">
                  <label htmlFor="line2">Address line 2</label>
                  <input
                    id="line2"
                    value={address.line2}
                    onChange={(e) => setAddressField('line2', e.target.value)}
                    autoComplete="shipping address-line2"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="city">City</label>
                  <input
                    id="city"
                    value={address.city}
                    onChange={(e) => setAddressField('city', e.target.value)}
                    required
                    autoComplete="shipping address-level2"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="state">State</label>
                  <input
                    id="state"
                    value={address.state}
                    onChange={(e) => setAddressField('state', e.target.value)}
                    required
                    autoComplete="shipping address-level1"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="country">Country</label>
                  <input
                    id="country"
                    value={address.country}
                    onChange={(e) => setAddressField('country', e.target.value)}
                    required
                    autoComplete="shipping country-name"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="pincode">Pincode</label>
                  <input
                    id="pincode"
                    value={address.pincode}
                    onChange={(e) => setAddressField('pincode', e.target.value)}
                    required
                    autoComplete="shipping postal-code"
                  />
                </div>
              </div>
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
        <form className="panel wide checkout-panel" onSubmit={payAndPlaceOrder}>
          <h3>Payment</h3>
          <p className="lede">
            Pay with Card or UPI. Demo checkout confirms instantly — no real charge
            until a live gateway key is connected.
          </p>

          <div className="payment-method-tabs" role="tablist" aria-label="Payment method">
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
          ) : (
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
          )}

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
              {busy ? 'Paying…' : `Pay ${formatPrice(total)} & place order`}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
