import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import ProductCard, { SkeletonGrid, formatPrice } from '../components/ProductCard';

export default function ShopPage() {
  const { username } = useParams();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.getShop(username);
        if (cancelled) return;
        setShop(data.shop);
        setProducts(data.products || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Shop not found');
          setShop(null);
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <section className="section">
        <p className="empty">Loading shop…</p>
        <SkeletonGrid count={6} />
      </section>
    );
  }

  if (error || !shop) {
    return (
      <section className="section">
        <p className="status error">{error || 'Shop not found'}</p>
        <Link className="btn btn-secondary" to="/catalog">
          Back to shop
        </Link>
      </section>
    );
  }

  return (
    <section className="section">
      <header className="shop-header">
        <div className="shop-header-main">
          {shop.avatar ? (
            <img className="shop-avatar" src={shop.avatar} alt="" />
          ) : (
            <div className="shop-avatar shop-avatar-fallback" aria-hidden="true">
              {(shop.shopName || shop.username || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="section-kicker">Shop</p>
            <h1>{shop.shopName || shop.username}</h1>
            <p className="shop-username">@{shop.username}</p>
            {shop.bio ? <p className="shop-bio">{shop.bio}</p> : null}
          </div>
        </div>
        <div className="shop-stats" aria-label="Shop stats">
          <div>
            <strong>{shop.ratingAverage || '—'}</strong>
            <span>Rating · {shop.reviewCount || 0} reviews</span>
          </div>
          <div>
            <strong>{shop.salesCount || 0}</strong>
            <span>Sales</span>
          </div>
          <div>
            <strong>{shop.listingCount || products.length}</strong>
            <span>Listings</span>
          </div>
        </div>
      </header>

      <div className="section-heading">
        <div>
          <h2>Listings</h2>
          <p>Active handmade pieces from this maker.</p>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="empty">No active listings right now.</p>
      ) : (
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
      )}

      {products[0]?.Price != null ? (
        <p className="muted-link shop-price-hint">
          From about {formatPrice(Math.min(...products.map((p) => Number(p.Price) || 0)))}
        </p>
      ) : null}
    </section>
  );
}
