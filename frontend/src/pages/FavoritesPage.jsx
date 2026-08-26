import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ProductCard, { SkeletonGrid } from '../components/ProductCard';

export default function FavoritesPage() {
  const { user, token, booting } = useAuth();
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.listFavorites(token);
        if (!cancelled) setProducts(data.product || []);
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

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2>Favorites</h2>
          <p>Listings you have saved.</p>
        </div>
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {loading ? <SkeletonGrid count={4} /> : null}
      {!loading && products.length === 0 ? (
        <p className="empty">
          No favorites yet. <Link to="/catalog">Find something you love</Link>
        </p>
      ) : null}
      <div className="product-grid">
        {products.map((product) => (
          <Link key={product._id} to={`/product/${product._id}`} className="product-link">
            <ProductCard product={product} />
          </Link>
        ))}
      </div>
    </section>
  );
}
