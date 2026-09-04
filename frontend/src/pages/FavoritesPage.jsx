import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import EmptyState from '../components/EmptyState';
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
          <p className="section-kicker">Saved</p>
          <h2>Favorites</h2>
          <p>Pieces you want to revisit later.</p>
        </div>
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {loading ? (
        <SkeletonGrid count={4} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No favorites yet"
          body="Tap Favorite on a listing to save it here."
          actionTo="/catalog"
          actionLabel="Browse shop"
        />
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              to={`/product/${product._id}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
