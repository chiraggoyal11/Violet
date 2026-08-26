import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ProductCard from '../components/ProductCard';

export default function MinePage() {
  const { user, booting } = useAuth();
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.listMyProducts(user._id);
        if (!cancelled) setProducts(data.product || []);
      } catch (err) {
        // S3 signed URL generation can fail without AWS creds; fall back to all products filtered client-side.
        try {
          const all = await api.listProducts();
          if (!cancelled) {
            setProducts((all.product || []).filter((p) => p.user_id === user._id));
          }
        } catch (fallbackErr) {
          if (!cancelled) setError(fallbackErr.message || err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function remove(id) {
    setBusyId(id);
    setError('');
    try {
      await api.deleteProducts([id]);
      setProducts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      // Delete may fail on S3 image cleanup with placeholder AWS keys; still remove from DB often fails.
      setError(err.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2>My listings</h2>
          <p>Manage the products you have published as {user.username}.</p>
        </div>
        <Link className="btn btn-primary" to="/sell">
          New listing
        </Link>
      </div>

      {error ? <p className="status error">{error}</p> : null}
      {loading ? <p className="empty">Loading your listings…</p> : null}
      {!loading && products.length === 0 ? (
        <p className="empty">You have not listed anything yet.</p>
      ) : null}

      <div className="product-grid">
        {products.map((product) => (
          <div key={product._id} style={{ display: 'grid', gap: '0.6rem' }}>
            <ProductCard product={product} />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busyId === product._id}
              onClick={() => remove(product._id)}
            >
              {busyId === product._id ? 'Removing…' : 'Remove'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
