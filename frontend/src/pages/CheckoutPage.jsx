import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import AddressFields from '../components/AddressFields';
import { formatPrice } from '../components/ProductCard';
import { isValidPincode } from '../data/geoAddress';

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

  const profileAddress = user?.address || emptyAddress;
  const useProfileDefault = user?.settings?.useProfileAddressAtCheckout !== false;
  const profileReady = hasProfileAddress(profileAddress);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/9c1d7e4a-f4ce-41e3-a9d5-5fcd9f0e2a1b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c7a1'},body:JSON.stringify({sessionId:'c7a1',hypothesisId:'H2',location:'CheckoutPage.jsx:mount-user',message:'checkout user.address on mount/update',data:{hasUser:Boolean(user),rawAddress:user?.address||null,profileAddress,profileReady,useProfileDefault,line1:user?.address?.line1||null,city:user?.address?.city||null,state:user?.address?.state||null,country:user?.address?.country||null,pincode:user?.address?.pincode||null,pincodeValid:isValidPincode(user?.address?.pincode),addressKeys:Object.keys(user?.address||{}),hasOwnLine1:Boolean(user?.address&&Object.prototype.hasOwnProperty.call(user.address,'line1'))},timestamp:Date.now()})}).catch(()=>{});
  }, [user]);
  // #endregion

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
      const seeded = { ...emptyAddress, ...profileAddress };
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/9c1d7e4a-f4ce-41e3-a9d5-5fcd9f0e2a1b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c7a1'},body:JSON.stringify({sessionId:'c7a1',hypothesisId:'H2',location:'CheckoutPage.jsx:seedEffect:ready',message:'seeding profile address into checkout',data:{branch:'profileReady',profileReady,useProfileDefault,profileAddress,seeded,seededLine1:seeded.line1||null,editingAddressNext:false},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setAddress(seeded);
      setEditingAddress(false);
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/9c1d7e4a-f4ce-41e3-a9d5-5fcd9f0e2a1b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c7a1'},body:JSON.stringify({sessionId:'c7a1',hypothesisId:'H2',location:'CheckoutPage.jsx:seedEffect:clear',message:'clearing checkout address (profile not ready)',data:{branch:'clear',profileReady,useProfileDefault,profileAddress,checks:{line1:Boolean(profileAddress?.line1),city:Boolean(profileAddress?.city),state:Boolean(profileAddress?.state),country:Boolean(profileAddress?.country),pincodeValid:isValidPincode(profileAddress?.pincode)},editingAddressNext:true},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setAddress(emptyAddress);
      setEditingAddress(true);
    }
  }, [user]);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/9c1d7e4a-f4ce-41e3-a9d5-5fcd9f0e2a1b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c7a1'},body:JSON.stringify({sessionId:'c7a1',hypothesisId:'H3',location:'CheckoutPage.jsx:address-state',message:'checkout address state after update',data:{address,editingAddress,addressComplete:Boolean(address.line1?.trim()&&address.city?.trim()&&address.state?.trim()&&address.country?.trim()&&isValidPincode(address.pincode)),profileReady,line1Empty:!address.line1,willShowEditForm:editingAddress||!Boolean(address.line1?.trim()&&address.city?.trim()&&address.state?.trim()&&address.country?.trim()&&isValidPincode(address.pincode))},timestamp:Date.now()})}).catch(()=>{});
  }, [address, editingAddress, profileReady]);
  // #endregion

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

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  function patchAddress(updates) {
    setAddress((prev) => ({ ...prev, ...updates }));
  }

  function continueFromAddress(e) {
    e.preventDefault();
    setError('');
    if (!addressComplete) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/9c1d7e4a-f4ce-41e3-a9d5-5fcd9f0e2a1b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c7a1'},body:JSON.stringify({sessionId:'c7a1',hypothesisId:'H3',location:'CheckoutPage.jsx:continueFromAddress:fail',message:'continueFromAddress validation failed',data:{address,addressComplete,line1:address.line1||'',city:address.city||'',state:address.state||'',country:address.country||'',pincode:address.pincode||'',pincodeValid:isValidPincode(address.pincode),editingAddress,profileReady},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setError(
        isValidPincode(address.pincode)
          ? 'Add a complete shipping address to continue.'
          : 'Pincode must be exactly 6 digits.',
      );
      setEditingAddress(true);
      return;
    }
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/9c1d7e4a-f4ce-41e3-a9d5-5fcd9f0e2a1b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c7a1'},body:JSON.stringify({sessionId:'c7a1',hypothesisId:'H3',location:'CheckoutPage.jsx:continueFromAddress:ok',message:'continueFromAddress passed',data:{address,editingAddress},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
