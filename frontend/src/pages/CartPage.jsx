import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import EmptyState from '../components/EmptyState';
import { formatPrice } from '../components/ProductCard';

export default function CartPage() {
  const { user, token, booting } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState('0.00');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getCart(token);
      setItems(data.items || []);
      setTotal(data.total || '0.00');
    } catch (err) {
      setError(err.message || 'Could not load cart');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  useEffect(() => {
    const defaultNote = user?.settings?.defaultCheckoutNote;
    if (defaultNote) setNote(defaultNote);
  }, [user]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function setQty(productId, quantity) {
    setBusy(true);
    try {
      const data = await api.updateCartItem(productId, quantity, token);
      setItems(data.items || []);
      setTotal(data.total || '0.00');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function checkout(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const data = await api.checkout(note, token);
      setOk(`Order placed (#${String(data.order._id).slice(-6)})`);
      setItems([]);
      setTotal('0.00');
      setNote('');
    } catch (err) {
      setError(err.message || 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

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
      {ok ? <p className="status ok">{ok}</p> : null}
      {loading ? <p className="empty">Loading cart…</p> : null}
      {!loading && items.length === 0 ? (
        <EmptyState
          title="Cart is empty"
          body="Browse handmade listings and add something you love."
          actionTo="/catalog"
          actionLabel="Browse shop"
        />
      ) : null}

      {items.length > 0 ? (
        <div className="cart-layout">
          <div className="cart-list">
            {items.map((item) => {
              const thumb =
                item.product?.ImageUrls?.[0] || item.product?.ImageUrl || null;
              const line = Number(item.product?.Price) * Number(item.quantity || 0);
              return (
                <div key={item.product_id} className="cart-row">
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
                  </div>
                  <div className="cart-qty" aria-label="Quantity">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setQty(item.product_id, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setQty(item.product_id, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-line-total">
                    {Number.isFinite(line) ? formatPrice(line) : '—'}
                  </div>
                </div>
              );
            })}
          </div>

          <form className="checkout-card" onSubmit={checkout}>
            <p className="section-kicker">Summary</p>
            <h3>Ready to order</h3>
            <div className="checkout-total">
              <span>Total</span>
              <strong>{formatPrice(total)}</strong>
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
            <button className="btn btn-accent" type="submit" disabled={busy}>
              {busy ? 'Placing…' : 'Place order'}
            </button>
            <Link className="muted-link checkout-continue" to="/catalog">
              Continue shopping
            </Link>
          </form>
        </div>
      ) : null}
    </section>
  );
}
