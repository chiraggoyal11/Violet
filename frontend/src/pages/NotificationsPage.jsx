import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { clearNotificationBadge } from '../components/Header';

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
      <div className="panel wide">
        <h1>Notifications</h1>
        {loading ? <p className="empty">Loading…</p> : null}
        {error ? <p className="status error">{error}</p> : null}
        {!loading && notifications.length === 0 ? (
          <p className="empty">You are all caught up.</p>
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
                  <Link className="btn btn-secondary" to={n.link}>
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
