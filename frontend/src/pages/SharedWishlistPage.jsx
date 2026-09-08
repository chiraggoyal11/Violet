import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import ProductCard, { SkeletonGrid } from '../components/ProductCard';

export default function SharedWishlistPage() {
  const { token: shareToken } = useParams();
  const [name, setName] = useState('Wishlist');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.getSharedWishlist(shareToken);
        if (cancelled) return;
        setName(data.wishlist?.name || 'Shared wishlist');
        setProducts(data.products || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Wishlist not found');
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Shared list</p>
          <h2>{name}</h2>
          <p>A public wishlist on Violet.</p>
        </div>
        <Link className="btn btn-secondary" to="/catalog">
          Browse shop
        </Link>
      </div>

      {error ? <p className="status error">{error}</p> : null}
      {loading ? (
        <>
          <p className="empty">Loading…</p>
          <SkeletonGrid count={4} />
        </>
      ) : null}
      {!loading && !error && products.length === 0 ? (
        <p className="empty">This wishlist has no active items.</p>
      ) : null}

      <div className="product-grid">
        {products.map((product) => (
          <Link
            key={product._id}
            to={`/product/${product._id}`}
            className="product-link"
            aria-label={`View ${product.Product_Name}`}
          >
            <ProductCard product={product} />
          </Link>
        ))}
      </div>
    </section>
  );
}
