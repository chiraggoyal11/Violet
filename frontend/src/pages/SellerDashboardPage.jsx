import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { formatPrice } from '../components/ProductCard';

export default function SellerDashboardPage() {
  const { user, token, booting } = useAuth();
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);
  const [balance, setBalance] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [shipDraft, setShipDraft] = useState({});
  const [payoutAmount, setPayoutAmount] = useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [s, salesData, payoutData] = await Promise.all([
        api.sellerStats(token),
        api.listSales(token),
        api.getPayouts(token).catch(() => null),
      ]);
      setStats(s.stats);
      setSales(salesData.sales || []);
      if (payoutData) {
        setBalance(payoutData.balance || null);
        setPayouts(payoutData.payouts || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, salesData, payoutData] = await Promise.all([
          api.sellerStats(token),
          api.listSales(token),
          api.getPayouts(token).catch(() => null),
        ]);
        if (cancelled) return;
        setStats(s.stats);
        setSales(salesData.sales || []);
        if (payoutData) {
          setBalance(payoutData.balance || null);
          setPayouts(payoutData.payouts || []);
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

  async function markShipped(saleId) {
    const draft = shipDraft[saleId] || {};
    setBusyId(saleId);
    setError('');
    setOk('');
    try {
      await api.updateOrderStatus(
        saleId,
        {
          status: 'shipped',
          trackingNumber: draft.trackingNumber || '',
          carrier: draft.carrier || '',
        },
        token,
      );
      setOk('Marked as shipped.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not mark shipped');
    } finally {
      setBusyId('');
    }
  }

  async function resolveSaleReturn(saleId, decision) {
    setBusyId(`${saleId}-${decision}`);
    setError('');
    setOk('');
    try {
      await api.resolveReturn(saleId, decision, token);
      setOk(`Return ${decision}.`);
      await load();
    } catch (err) {
      setError(err.message || 'Could not resolve return');
    } finally {
      setBusyId('');
    }
  }

  async function requestPayout(e) {
    e.preventDefault();
    setBusyId('payout');
    setError('');
    setOk('');
    try {
      await api.requestPayout({ amount: Number(payoutAmount) }, token);
      setOk('Payout requested.');
      setPayoutAmount('');
      await load();
    } catch (err) {
      setError(err.message || 'Could not request payout');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2>Seller dashboard</h2>
          <p>How your shop is doing, {user.username}.</p>
        </div>
        <div className="form-actions">
          <Link className="btn btn-secondary" to={`/shop/${encodeURIComponent(user.username)}`}>
            View shop
          </Link>
          <Link className="btn btn-primary" to="/sell">
            New listing
          </Link>
        </div>
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {ok ? <p className="status ok">{ok}</p> : null}
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

      {balance ? (
        <div className="panel wide payout-panel">
          <h3>Payouts</h3>
          <div className="stats-row">
            <div className="stat">
              <span>Earned</span>
              <strong>{formatPrice(balance.earned)}</strong>
            </div>
            <div className="stat">
              <span>Paid out</span>
              <strong>{formatPrice(balance.paidOut)}</strong>
            </div>
            <div className="stat">
              <span>Available</span>
              <strong>{formatPrice(balance.available)}</strong>
            </div>
          </div>
          <form className="coupon-row" onSubmit={requestPayout}>
            <input
              type="number"
              min="100"
              step="0.01"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              placeholder="Amount (min ₹100)"
              required
            />
            <button className="btn btn-accent" type="submit" disabled={busyId === 'payout'}>
              Request payout
            </button>
          </form>
          {payouts.length > 0 ? (
            <ul className="admin-list">
              {payouts.slice(0, 5).map((p) => (
                <li key={p._id}>
                  <div>
                    <strong>{formatPrice(p.amount)}</strong>
                    <span className="muted-link">{p.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <h3>Recent sales</h3>
      {!loading && sales.length === 0 ? <p className="empty">No sales yet.</p> : null}
      <div className="order-list">
        {sales.map((sale) => {
          const canShip = sale.status === 'placed' || sale.status === 'shipped';
          const returnOpen = sale.returnRequest?.status === 'requested';
          const draft = shipDraft[sale._id] || {};
          return (
            <article key={sale._id} className="panel wide">
              <header className="order-head">
                <div>
                  <strong>#{String(sale._id).slice(-6)}</strong>
                  <span className={`status-pill status-${sale.status || 'placed'}`}>
                    {sale.status || 'placed'}
                  </span>
                </div>
                <span>{formatPrice(sale.total)}</span>
              </header>
              <ul>
                {sale.items.map((item, idx) => (
                  <li key={`${sale._id}-${idx}`}>
                    {item.quantity}× {item.Product_Name}
                  </li>
                ))}
              </ul>
              {sale.trackingNumber || sale.carrier ? (
                <p className="order-note">
                  Tracking: {[sale.carrier, sale.trackingNumber].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              {returnOpen ? (
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-accent"
                    disabled={busyId.startsWith(sale._id)}
                    onClick={() => resolveSaleReturn(sale._id, 'approved')}
                  >
                    Approve return
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId.startsWith(sale._id)}
                    onClick={() => resolveSaleReturn(sale._id, 'rejected')}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId.startsWith(sale._id)}
                    onClick={() => resolveSaleReturn(sale._id, 'refunded')}
                  >
                    Refund
                  </button>
                </div>
              ) : null}
              {canShip && sale.status !== 'delivered' && sale.status !== 'returned' ? (
                <div className="ship-row">
                  <input
                    placeholder="Carrier"
                    value={draft.carrier || ''}
                    onChange={(e) =>
                      setShipDraft((prev) => ({
                        ...prev,
                        [sale._id]: { ...draft, carrier: e.target.value },
                      }))
                    }
                  />
                  <input
                    placeholder="Tracking number"
                    value={draft.trackingNumber || ''}
                    onChange={(e) =>
                      setShipDraft((prev) => ({
                        ...prev,
                        [sale._id]: { ...draft, trackingNumber: e.target.value },
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="btn btn-accent"
                    disabled={busyId === sale._id}
                    onClick={() => markShipped(sale._id)}
                  >
                    Mark shipped
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
