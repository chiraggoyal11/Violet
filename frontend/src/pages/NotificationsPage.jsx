import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { clearNotificationBadge } from '../components/Header';
import EmptyState from '../components/EmptyState';

export default function NotificationsPage() {
  const { user, token, booting } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listNotifications(token);
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err.message || 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
    api
      .markAllNotificationsRead(token)
      .then(() => clearNotificationBadge())
      .catch(() => {});
  }, [token]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Alerts</p>
          <h2>Notifications</h2>
          <p>Orders, messages, and marketplace updates.</p>
        </div>
      </div>
      <div className="notification-shell">
        {loading ? <p className="empty">Loading…</p> : null}
        {error ? <p className="status error">{error}</p> : null}
        {!loading && notifications.length === 0 ? (
          <EmptyState title="You are all caught up" body="New alerts will appear here." />
        ) : (
          <ul className="notification-list">
            {notifications.map((n) => (
              <li key={n._id} className={n.read ? 'read' : 'unread'}>
                <div>
                  <strong>{n.title}</strong>
                  {n.body ? <p>{n.body}</p> : null}
                  <time className="muted-link">
                    {new Date(n.createdAt).toLocaleString()}
                  </time>
                </div>
                {n.link ? (
                  <Link className="btn btn-secondary btn-compact" to={n.link}>
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
