import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import EmptyState from '../components/EmptyState';
import ProductCard, { formatPrice } from '../components/ProductCard';

export default function WishlistPage() {
  const { user, token, booting } = useAuth();
  const [products, setProducts] = useState([]);
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getWishlist(token);
      setProducts(data.products || []);
      setShareUrl(data.shareUrl || '');
    } catch (err) {
      setError(err.message || 'Could not load wishlist');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function removeItem(productId) {
    setBusyId(productId);
    setError('');
    setOk('');
    try {
      await api.removeWishlistItem(productId, token);
      setProducts((prev) => prev.filter((p) => String(p._id) !== String(productId)));
      setOk('Removed from wishlist.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  async function copyShare() {
    if (!shareUrl) return;
    const full = `${window.location.origin}${shareUrl}`;
    try {
      await navigator.clipboard.writeText(full);
      setOk('Share link copied.');
    } catch {
      setOk(full);
    }
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Saved</p>
          <h2>Wishlist</h2>
          <p>Pieces you want to revisit — share the list with friends.</p>
        </div>
        {shareUrl ? (
          <button type="button" className="btn btn-secondary" onClick={copyShare}>
            Copy share link
          </button>
        ) : null}
      </div>

      {error ? <p className="status error">{error}</p> : null}
      {ok ? <p className="status ok">{ok}</p> : null}
      {shareUrl ? (
        <p className="muted-link">
          Public link: <Link to={shareUrl}>{shareUrl}</Link>
        </p>
      ) : null}

      {loading ? <p className="empty">Loading wishlist…</p> : null}
      {!loading && products.length === 0 ? (
        <EmptyState
          title="Wishlist is empty"
          body="Save products from a listing page to build your list."
          actionTo="/catalog"
          actionLabel="Browse shop"
        />
      ) : null}

      <div className="product-grid">
        {products.map((product) => (
          <div key={product._id} className="listing-manage">
            <Link to={`/product/${product._id}`} className="product-link">
              <ProductCard product={product} />
            </Link>
            <div className="form-actions">
              <span className="muted-link">{formatPrice(product.Price)}</span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busyId === product._id}
                onClick={() => removeItem(product._id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
