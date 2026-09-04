import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function HomePage() {
  const { user, booting } = useAuth();

  return (
    <section className="hero" aria-label="Violet introduction">
      <div className="hero-media" aria-hidden="true" />
      <div className="hero-content">
        <p className="hero-brand">Violet</p>
        <h1>
          {user
            ? `Welcome back${user.username ? `, ${user.username}` : ''}.`
            : 'List handmade goods. Find what feels like home.'}
        </h1>
        <p>
          {user
            ? 'Browse the catalog, manage your listings, or pick up where you left off.'
            : 'A quiet marketplace for makers and finders — publish a listing, browse the catalog, and keep your shop in one place.'}
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/catalog">
            Browse catalog
          </Link>
          {booting ? null : user ? (
            <>
              <Link className="btn btn-secondary" to="/sell">
                Sell something
              </Link>
              <Link className="btn btn-secondary" to="/profile">
                Your profile
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-secondary" to="/sell">
                Start selling
              </Link>
              <Link className="btn btn-secondary" to="/login">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
