import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="site-header">
      <Link to="/" className="brand-mark">
        Violet
      </Link>
      <nav className="nav-links" aria-label="Primary">
        <NavLink to="/catalog">Catalog</NavLink>
        {user ? (
          <>
            <NavLink to="/sell">Sell</NavLink>
            <NavLink to="/mine">My listings</NavLink>
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
