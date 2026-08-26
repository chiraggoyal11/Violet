import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { formatPrice } from '../components/ProductCard';

export default function SellerDashboardPage() {
  const { user, token, booting } = useAuth();
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, salesData] = await Promise.all([
          api.sellerStats(token),
          api.listSales(token),
        ]);
        if (!cancelled) {
          setStats(s.stats);
          setSales(salesData.sales || []);
        }
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
          <h2>Seller dashboard</h2>
          <p>How your shop is doing, {user.username}.</p>
        </div>
        <Link className="btn btn-primary" to="/sell">
          New listing
        </Link>
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="empty">Loading stats…</p> : null}
      {stats ? (
        <div className="stats-row">
          <div className="stat">
            <span>Active</span>
            <strong>{stats.active}</strong>
          </div>
          <div className="stat">
            <span>Sold</span>
            <strong>{stats.sold}</strong>
          </div>
          <div className="stat">
            <span>Revenue</span>
            <strong>{formatPrice(stats.revenue)}</strong>
          </div>
        </div>
      ) : null}

      <h3>Recent sales</h3>
      {!loading && sales.length === 0 ? <p className="empty">No sales yet.</p> : null}
      <div className="order-list">
        {sales.map((sale) => (
          <article key={sale._id} className="panel wide">
            <header className="order-head">
              <strong>#{String(sale._id).slice(-6)}</strong>
              <span>{formatPrice(sale.total)}</span>
            </header>
            <ul>
              {sale.items.map((item, idx) => (
                <li key={`${sale._id}-${idx}`}>
                  {item.quantity}× {item.Product_Name}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
