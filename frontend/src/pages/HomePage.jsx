import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function HomePage() {
  const { user, booting } = useAuth();

  // Signed-in users stay in the app — don't show the guest marketing landing.
  if (!booting && user) {
    return <Navigate to="/catalog" replace />;
  }

  return (
    <section className="hero" aria-label="Violet introduction">
      <div className="hero-media" aria-hidden="true" />
      <div className="hero-content">
        <p className="hero-brand">Violet</p>
        <h1>List handmade goods. Find what feels like home.</h1>
        <p>
          A quiet marketplace for makers and finders — publish a listing, browse
          the catalog, and keep your shop in one place.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-accent" to="/catalog">
            Browse shop
          </Link>
          <Link className="btn btn-secondary hero-secondary" to="/login">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
