import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import EmptyState from '../components/EmptyState';
import { formatPrice } from '../components/ProductCard';
import { refreshCartBadge } from '../components/BottomNav';

function isOnlinePending(order) {
  return (
    order?.paymentStatus === 'pending' &&
    (order.paymentMethod === 'upi' || order.paymentMethod === 'card')
  );
}

function Timeline({ events }) {
  if (!events?.length) return null;
  return (
    <ol className="order-timeline">
      {events.map((ev, idx) => (
        <li key={`${ev.at || idx}-${ev.status}`}>
          <strong>{ev.status?.replace(/_/g, ' ') || 'update'}</strong>
          {ev.note ? <span>{ev.note}</span> : null}
          {ev.at ? (
            <time>{new Date(ev.at).toLocaleString()}</time>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export default function OrdersPage() {
  const { user, token, booting } = useAuth();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [returnReason, setReturnReason] = useState({});

  async function loadOrders() {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.listOrders(token);
      setOrders(data.orders || []);
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

  const pendingOrders = orders.filter(isOnlinePending);

  async function cancelPending(orderId) {
    setBusyId(orderId);
    setError('');
    setOk('');
    try {
      await api.cancelPayment(orderId, token);
      setOk('Payment cancelled. You can place a new order from your cart.');
      await loadOrders();
      refreshCartBadge();
    } catch (err) {
      setError(err.message || 'Could not cancel payment');
    } finally {
      setBusyId('');
    }
  }

  async function markDelivered(orderId) {
    setBusyId(orderId);
    setError('');
    setOk('');
    try {
      await api.updateOrderStatus(orderId, { status: 'delivered' }, token);
      setOk('Marked as delivered.');
      await loadOrders();
    } catch (err) {
      setError(err.message || 'Could not update order');
    } finally {
      setBusyId('');
    }
  }

  async function submitReturn(orderId) {
    const reason = String(returnReason[orderId] || '').trim();
    setBusyId(orderId);
    setError('');
    setOk('');
    try {
      await api.requestReturn(orderId, reason, token);
      setOk('Return requested.');
      setReturnReason((prev) => ({ ...prev, [orderId]: '' }));
      await loadOrders();
    } catch (err) {
      setError(err.message || 'Could not request return');
    } finally {
      setBusyId('');
    }
  }

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
      {ok ? <p className="status ok">{ok}</p> : null}
      {pendingOrders.length > 0 ? (
        <div className="payment-pending-banner" role="status">
          <div>
            <strong>
              {pendingOrders.length === 1
                ? 'Payment in progress'
                : `${pendingOrders.length} payments in progress`}
            </strong>
            <p>
              Finish UPI approval or cancel below. Unfinished payments cancel automatically
              after 2 minutes.
            </p>
          </div>
        </div>
      ) : null}
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
        {orders.map((order) => {
          const pending = isOnlinePending(order);
          const returnStatus = order.returnRequest?.status;
          const canReturn =
            order.status === 'delivered' &&
            (!returnStatus || returnStatus === 'none');
          const canMarkDelivered = order.status === 'shipped';
          return (
            <article
              key={order._id}
              className={`order-card${pending ? ' order-card-pending' : ''}`}
            >
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
                  <span
                    className={`status-pill status-${
                      pending ? 'pending-pay' : order.status || 'placed'
                    }`}
                  >
                    {pending ? 'payment in progress' : order.status || 'placed'}
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
              {order.shippingAddress?.line1 ? (
                <p className="order-note">
                  Ship to:{' '}
                  {[
                    order.shippingAddress.line1,
                    order.shippingAddress.line2,
                    order.shippingAddress.city,
                    order.shippingAddress.state,
                    order.shippingAddress.country,
                    order.shippingAddress.pincode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              ) : null}
              {order.paymentMethod ? (
                <p className="order-note">
                  {order.paymentMethod === 'cod'
                    ? 'Cash on delivery'
                    : `Paid via ${String(order.paymentMethod).toUpperCase()}`}
                  {order.paymentStatus ? ` · ${order.paymentStatus}` : ''}
                  {order.paymentDetail ? ` · ${order.paymentDetail}` : ''}
                  {order.paymentRef ? ` · ${order.paymentRef}` : ''}
                  {order.paymentProvider ? ` · ${order.paymentProvider}` : ''}
                </p>
              ) : null}
              {order.trackingNumber || order.carrier ? (
                <p className="order-note">
                  Tracking:{' '}
                  {[order.carrier, order.trackingNumber].filter(Boolean).join(' · ')}
                </p>
              ) : null}
              {order.note ? <p className="order-note">Note: {order.note}</p> : null}
              {returnStatus && returnStatus !== 'none' ? (
                <p className="order-note">
                  Return: {returnStatus}
                  {order.returnRequest?.reason ? ` · ${order.returnRequest.reason}` : ''}
                </p>
              ) : null}

              <Timeline events={order.timeline} />

              {pending ? (
                <div className="order-pending-actions form-actions">
                  <Link
                    className="btn btn-accent"
                    to={`/checkout?resume=${order._id}`}
                  >
                    Continue payment
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId === order._id}
                    onClick={() => cancelPending(order._id)}
                  >
                    {busyId === order._id ? 'Cancelling…' : 'Cancel payment'}
                  </button>
                </div>
              ) : null}

              {canMarkDelivered ? (
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-accent"
                    disabled={busyId === order._id}
                    onClick={() => markDelivered(order._id)}
                  >
                    Mark delivered
                  </button>
                </div>
              ) : null}

              {canReturn ? (
                <div className="return-request-row">
                  <label className="form-field">
                    <span>Request return</span>
                    <input
                      value={returnReason[order._id] || ''}
                      onChange={(e) =>
                        setReturnReason((prev) => ({
                          ...prev,
                          [order._id]: e.target.value,
                        }))
                      }
                      placeholder="Why are you returning this?"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId === order._id}
                    onClick={() => submitReturn(order._id)}
                  >
                    Request return
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
