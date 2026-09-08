import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { refreshCartBadge } from '../components/BottomNav';
import EmptyState from '../components/EmptyState';
import { formatPrice } from '../components/ProductCard';

function CartItemRow({
  item,
  busy,
  onQty,
  onSaveForLater,
  onRemove,
  onMoveToCart,
  mode = 'cart',
}) {
  const thumb = item.product?.ImageUrls?.[0] || item.product?.ImageUrl || null;
  const line = Number(item.product?.Price) * Number(item.quantity || 0);

  return (
    <div className="cart-row">
      <Link className="cart-thumb" to={`/product/${item.product_id}`}>
        {thumb ? (
          <img src={thumb} alt="" />
        ) : (
          <span>{item.product?.Product_Name?.slice(0, 1) || '?'}</span>
        )}
      </Link>
      <div className="cart-copy">
        <Link to={`/product/${item.product_id}`}>
          <strong>{item.product.Product_Name}</strong>
        </Link>
        <div className="muted-link">{formatPrice(item.product.Price)} each</div>
        <div className="cart-row-actions">
          {mode === 'cart' ? (
            <>
              <button
                type="button"
                className="cart-text-btn"
                disabled={busy}
                onClick={() => onSaveForLater(item.product_id)}
              >
                Save for later
              </button>
              <button
                type="button"
                className="cart-text-btn danger"
                disabled={busy}
                onClick={() => onRemove(item.product_id)}
              >
                Remove
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="cart-text-btn"
                disabled={busy}
                onClick={() => onMoveToCart(item.product_id)}
              >
                Move to cart
              </button>
              <button
                type="button"
                className="cart-text-btn danger"
                disabled={busy}
                onClick={() => onRemove(item.product_id)}
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
      {mode === 'cart' ? (
        <div className="cart-qty" aria-label="Quantity">
          <button
            type="button"
            disabled={busy}
            onClick={() => onQty(item.product_id, item.quantity - 1)}
          >
            −
          </button>
          <span>{item.quantity}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => onQty(item.product_id, item.quantity + 1)}
          >
            +
          </button>
        </div>
      ) : (
        <div className="cart-qty cart-qty-static" aria-label="Quantity">
          <span>Qty {item.quantity}</span>
        </div>
      )}
      <div className="cart-line-total">
        {Number.isFinite(line) ? formatPrice(line) : '—'}
      </div>
    </div>
  );
}

export default function CartPage() {
  const { user, token, booting } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [savedForLater, setSavedForLater] = useState([]);
  const [total, setTotal] = useState('0.00');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);

  function applyCart(data) {
    setItems(data.items || []);
    setSavedForLater(data.savedForLater || []);
    setTotal(data.total || '0.00');
    refreshCartBadge();
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [data, pending] = await Promise.all([
        api.getCart(token),
        api.pendingPayment(token).catch(() => null),
      ]);
      applyCart(data);
      setPendingPayment(pending?.pending || null);
    } catch (err) {
      setError(err.message || 'Could not load cart');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function setQty(productId, quantity) {
    setBusy(true);
    setError('');
    try {
      const data = await api.updateCartItem(productId, quantity, token);
      applyCart(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeFromCart(productId) {
    setBusy(true);
    setError('');
    try {
      const data = await api.removeCartItem(productId, token);
      applyCart(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveForLater(productId) {
    setBusy(true);
    setError('');
    try {
      const data = await api.saveCartItemForLater(productId, token);
      applyCart(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function moveToCart(productId) {
    setBusy(true);
    setError('');
    try {
      const data = await api.moveSavedToCart(productId, token);
      applyCart(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeSaved(productId) {
    setBusy(true);
    setError('');
    try {
      const data = await api.removeSavedItem(productId, token);
      applyCart(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const emptyActive = !loading && items.length === 0;
  const emptyAll = emptyActive && savedForLater.length === 0;

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Checkout</p>
          <h2>Your cart</h2>
          <p>Review handmade pieces before you place the order.</p>
        </div>
        <Link className="btn btn-secondary" to="/orders">
          Order history
        </Link>
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {pendingPayment ? (
        <div className="payment-pending-banner" role="status">
          <div>
            <strong>Payment in progress</strong>
            <p>
              Order #{String(pendingPayment._id).slice(-6)} is waiting for UPI approval.
              Finish it before placing another order, or cancel from Orders. Auto-cancels
              after 2 minutes.
            </p>
          </div>
          <div className="form-actions">
            <Link className="btn btn-accent" to={`/checkout?resume=${pendingPayment._id}`}>
              Continue payment
            </Link>
            <Link className="btn btn-secondary" to="/orders">
              Open Orders
            </Link>
          </div>
        </div>
      ) : null}
      {loading ? <p className="empty">Loading cart…</p> : null}
      {emptyAll ? (
        <EmptyState
          title="Cart is empty"
          body="Browse handmade listings and add something you love."
          actionTo="/catalog"
          actionLabel="Browse shop"
        />
      ) : null}

      {!loading && !emptyAll ? (
        <div className="cart-layout">
          <div className="cart-list-stack">
            <div className="cart-list">
              <div className="cart-list-heading">
                <h3>Added in cart</h3>
                <p className="muted-link">
                  {items.length
                    ? `${items.length} item${items.length === 1 ? '' : 's'}`
                    : 'No items in cart'}
                </p>
              </div>
              {emptyActive ? (
                <p className="cart-empty-note">
                  Your cart is empty. Move something from Saved for later, or keep shopping.
                </p>
              ) : (
                items.map((item) => (
                  <CartItemRow
                    key={item.product_id}
                    item={item}
                    busy={busy}
                    mode="cart"
                    onQty={setQty}
                    onSaveForLater={saveForLater}
                    onRemove={removeFromCart}
                  />
                ))
              )}
            </div>

            <div className="cart-list cart-saved-list">
              <div className="cart-list-heading">
                <h3>Saved for later</h3>
                <p className="muted-link">
                  {savedForLater.length
                    ? `${savedForLater.length} item${savedForLater.length === 1 ? '' : 's'}`
                    : 'Nothing saved yet'}
                </p>
              </div>
              {savedForLater.length === 0 ? (
                <p className="cart-empty-note">
                  Use Save for later on a cart item to keep it here without checking out.
                </p>
              ) : (
                savedForLater.map((item) => (
                  <CartItemRow
                    key={`saved-${item.product_id}`}
                    item={item}
                    busy={busy}
                    mode="saved"
                    onMoveToCart={moveToCart}
                    onRemove={removeSaved}
                  />
                ))
              )}
            </div>
          </div>

          <div className="checkout-card">
            <p className="section-kicker">Summary</p>
            <h3>Ready to order</h3>
            <div className="checkout-total">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <p className="muted-link">
              Next you will confirm shipping address and payment.
            </p>
            <button
              className="btn btn-accent"
              type="button"
              disabled={busy || items.length === 0}
              onClick={() => navigate('/checkout')}
            >
              Place order
            </button>
            <Link className="muted-link checkout-continue" to="/catalog">
              Continue shopping
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}
