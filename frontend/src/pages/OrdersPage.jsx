import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import EmptyState from '../components/EmptyState';
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
          <p className="section-kicker">Purchases</p>
          <h2>Orders</h2>
          <p>Track what you have bought on Violet.</p>
        </div>
        <Link className="btn btn-secondary" to="/cart">
          Open cart
        </Link>
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="empty">Loading orders…</p> : null}
      {!loading && orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          body="When you checkout, your purchases will show up here."
          actionTo="/catalog"
          actionLabel="Browse shop"
        />
      ) : null}
      <div className="order-list">
        {orders.map((order) => (
          <article key={order._id} className="order-card">
            <header className="order-head">
              <div>
                <strong>Order #{String(order._id).slice(-6)}</strong>
                <time className="muted-link">
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleString()
                    : ''}
                </time>
              </div>
              <div className="order-head-right">
                <span className={`status-pill status-${order.status || 'placed'}`}>
                  {order.status || 'placed'}
                </span>
                <span className="order-total">{formatPrice(order.total)}</span>
              </div>
            </header>
            <ul className="order-items">
              {order.items.map((item, idx) => (
                <li key={`${order._id}-${idx}`}>
                  <span>
                    {item.quantity}× {item.Product_Name}
                  </span>
                  <span>{formatPrice(item.Price)}</span>
                </li>
              ))}
            </ul>
            {order.note ? <p className="order-note">Note: {order.note}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
