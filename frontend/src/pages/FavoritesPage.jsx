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
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listFavorites(token);
      setProducts(data.product || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    load();
  }, [token]);

  async function removeFavorite(productId) {
    setBusyId(productId);
    setError('');
    setOk('');
    try {
      await api.removeFavorite(productId, token);
      setProducts((prev) => prev.filter((p) => String(p._id) !== String(productId)));
      setOk('Removed from favorites.');
    } catch (err) {
      setError(err.message || 'Could not remove favorite');
    } finally {
      setBusyId(null);
    }
  }

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Saved</p>
          <h2>Favorites</h2>
          <p>Pieces you want to revisit later. Remove any you no longer want saved.</p>
        </div>
      </div>
      {error ? <p className="status error">{error}</p> : null}
      {ok ? <p className="status ok">{ok}</p> : null}
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
            <div key={product._id} className="favorite-item">
              <ProductCard product={product} to={`/product/${product._id}`} />
              <button
                type="button"
                className="btn btn-secondary favorite-remove"
                disabled={busyId === product._id}
                onClick={() => removeFavorite(product._id)}
              >
                {busyId === product._id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
