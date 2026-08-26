import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
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
          <h2>Cart</h2>
          <p>Review items and place your order.</p>
        </div>
        <Link className="btn btn-secondary" to="/orders">
          Order history
        </Link>
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {ok ? <p className="status ok">{ok}</p> : null}
      {loading ? <p className="empty">Loading cart…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="empty">
          Your cart is empty. <Link to="/catalog">Browse the catalog</Link>
        </p>
      ) : null}

      <div className="cart-list">
        {items.map((item) => (
          <div key={item.product_id} className="cart-row">
            <div>
              <strong>{item.product.Product_Name}</strong>
              <div className="muted-link">{formatPrice(item.product.Price)} each</div>
            </div>
            <div className="cart-qty">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setQty(item.product_id, item.quantity - 1)}
              >
                −
              </button>
              <span>{item.quantity}</span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setQty(item.product_id, item.quantity + 1)}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 ? (
        <form className="panel wide checkout" onSubmit={checkout}>
          <p>
            Total: <strong>{formatPrice(total)}</strong>
          </p>
          <div className="form-field">
            <label htmlFor="note">Order note (optional)</label>
            <textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <button className="btn btn-accent" type="submit" disabled={busy}>
            {busy ? 'Placing…' : 'Checkout'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
