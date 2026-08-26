import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { formatPrice } from '../components/ProductCard';

export default function OrdersPage() {
  const { user, token, booting } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.listOrders(token);
        if (!cancelled) setOrders(data.orders || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2>Orders</h2>
          <p>Purchases you have placed on Violet.</p>
        </div>
        <Link className="btn btn-secondary" to="/cart">
          Cart
        </Link>
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="empty">Loading orders…</p> : null}
      {!loading && orders.length === 0 ? (
        <p className="empty">No orders yet.</p>
      ) : null}
      <div className="order-list">
        {orders.map((order) => (
          <article key={order._id} className="panel wide">
            <header className="order-head">
              <strong>#{String(order._id).slice(-6)}</strong>
              <span>{formatPrice(order.total)}</span>
              <span className="badge category">{order.status}</span>
            </header>
            <ul>
              {order.items.map((item, idx) => (
                <li key={`${order._id}-${idx}`}>
                  {item.quantity}× {item.Product_Name} — {formatPrice(item.Price)}
                </li>
              ))}
            </ul>
            {order.note ? <p className="muted-link">Note: {order.note}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
