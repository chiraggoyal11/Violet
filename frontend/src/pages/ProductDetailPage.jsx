import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatPrice } from '../components/ProductCard';

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.getProduct(id);
        if (!cancelled) setProduct(data.product);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Product not found');
          setProduct(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p className="empty">Loading product…</p>;
  if (error) {
    return (
      <section className="section">
        <p className="status error">{error}</p>
        <Link className="btn btn-secondary" to="/catalog">
          Back to catalog
        </Link>
      </section>
    );
  }

  return (
    <section className="section detail-section">
      <Link className="muted-link" to="/catalog">
        ← Back to catalog
      </Link>
      <div className="detail-layout">
        <div className="detail-media">
          {product.ImageUrl ? (
            <img src={product.ImageUrl} alt={product.Product_Name} />
          ) : (
            <div className="product-fallback large">{product.Product_Name}</div>
          )}
        </div>
        <div className="detail-copy">
          <h1>{product.Product_Name}</h1>
          <p className="detail-price">{formatPrice(product.Price)}</p>
          <p>{product.Product_Detail}</p>
        </div>
      </div>
    </section>
  );
}
