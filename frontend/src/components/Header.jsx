import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const NOTIF_CLEARED = 'violet:notifications-cleared';

export function clearNotificationBadge() {
  window.dispatchEvent(new Event(NOTIF_CLEARED));
}

function initials(user) {
  const first = (user?.first_name || '').trim();
  const last = (user?.last_name || '').trim();
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
  }
  const name = (user?.username || '?').trim();
  return name.slice(0, 2).toUpperCase();
}

export default function Header() {
  const { user, token, logout } = useAuth();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

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

    function onCleared() {
      setUnread(0);
    }

    poll();
    const t = setInterval(poll, 30000);
    window.addEventListener(NOTIF_CLEARED, onCleared);
    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener(NOTIF_CLEARED, onCleared);
    };
  }, [token]);

  return (
    <header className="site-header top-bar">
      <Link to={user ? '/catalog' : '/'} className="brand-mark">
        Violet
      </Link>

      <div className="top-bar-actions">
        {user ? (
          <>
            <button
              type="button"
              className="icon-btn bell-btn"
              aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
              onClick={() => navigate('/notifications')}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2Z"
                />
              </svg>
              {unread > 0 ? (
                <span className="badge-count" aria-hidden="true">
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </button>

            <div className="profile-menu" ref={menuRef}>
              <button
                type="button"
                className="profile-avatar-btn"
                aria-label="Account menu"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="profile-avatar-img" />
                ) : (
                  <span className="profile-avatar-fallback">{initials(user)}</span>
                )}
              </button>
              {menuOpen ? (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-head">
                    <strong>{user.username}</strong>
                    {user.email ? <span>{user.email}</span> : null}
                  </div>
                  <Link role="menuitem" to="/profile" onClick={() => setMenuOpen(false)}>
                    Profile
                  </Link>
                  <Link role="menuitem" to="/settings" onClick={() => setMenuOpen(false)}>
                    Settings
                  </Link>
                  <Link role="menuitem" to="/favorites" onClick={() => setMenuOpen(false)}>
                    Favorites
                  </Link>
                  <Link role="menuitem" to="/mine" onClick={() => setMenuOpen(false)}>
                    My listings
                  </Link>
                  <Link role="menuitem" to="/seller" onClick={() => setMenuOpen(false)}>
                    Seller dashboard
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="linkish"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                      navigate('/');
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="top-bar-guest">
            <Link to="/login">Sign in</Link>
            <Link className="btn btn-primary btn-compact" to="/register">
              Join
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
