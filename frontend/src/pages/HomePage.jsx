import { Link } from 'react-router-dom';

export default function HomePage() {
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
          <Link className="btn btn-primary" to="/catalog">
            Browse catalog
          </Link>
          <Link className="btn btn-secondary" to="/sell">
            Start selling
          </Link>
          <Link className="btn btn-secondary" to="/login">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
