import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Header() {
  const { user, token, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!token) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    async function poll() {
      try {
        const data = await api.unreadNotificationCount(token);
        if (!cancelled) setUnread(data.unread || 0);
      } catch {
        /* ignore */
      }
    }
    poll();
    const t = setInterval(poll, 30000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token]);

  return (
    <header className="site-header">
      <Link to="/" className="brand-mark">
        Violet
      </Link>
      <nav className="nav-links" aria-label="Primary">
        <NavLink to="/catalog">Catalog</NavLink>
        {user ? (
          <>
            <NavLink to="/cart">Cart</NavLink>
            <NavLink to="/favorites">Favorites</NavLink>
            <NavLink to="/orders">Orders</NavLink>
            <NavLink to="/messages">Messages</NavLink>
            <NavLink to="/notifications" className="notif-link">
              Alerts{unread ? ` (${unread})` : ''}
            </NavLink>
            <NavLink to="/sell">Sell</NavLink>
            <NavLink to="/mine">My listings</NavLink>
            <NavLink to="/seller">Dashboard</NavLink>
            <NavLink to="/profile">Profile</NavLink>
            <button type="button" className="linkish" onClick={logout}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Sign in</NavLink>
            <Link className="btn btn-primary" to="/register">
              Join
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
