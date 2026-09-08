import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ProductCard, { SkeletonGrid } from '../components/ProductCard';

const PREVIEW_LIMIT = 8;

function groupByCategory(products, categoryOrder) {
  const map = new Map();
  for (const product of products) {
    const key = product.category || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(product);
  }
  const ordered = [];
  for (const cat of categoryOrder) {
    if (map.has(cat)) {
      ordered.push({ category: cat, products: map.get(cat) });
      map.delete(cat);
    }
  }
  for (const [category, list] of map.entries()) {
    ordered.push({ category, products: list });
  }
  return ordered;
}

export default function HomePage() {
  const { user, booting } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['Home', 'Fashion', 'Art', 'Food', 'Other']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (booting || user) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.listProducts({
          status: 'active',
          sort: 'newest',
          page,
          limit: PREVIEW_LIMIT,
        });
        if (cancelled) return;
        setProducts(data.product || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        if (data.categories?.length) setCategories(data.categories);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, booting, user]);

  const grouped = useMemo(
    () => groupByCategory(products, categories),
    [products, categories],
  );

  if (!booting && user) {
    return <Navigate to="/catalog" replace />;
  }

  if (booting) {
    return <p className="empty">Loading…</p>;
  }

  return (
    <>
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

      <section className="section home-section home-guest-catalog" aria-label="Shop by category">
        <div className="section-heading home-heading">
          <div>
            <p className="section-kicker">Shop</p>
            <h2>Browse by category</h2>
            <p>See handmade listings grouped by category, then page through more.</p>
          </div>
          <Link className="btn btn-secondary" to="/catalog">
            Open full shop
          </Link>
        </div>

        {error ? <p className="status error">{error}</p> : null}
        {loading ? (
          <SkeletonGrid />
        ) : products.length === 0 ? (
          <p className="empty">No listings yet — check back soon.</p>
        ) : (
          <div className="category-sections">
            {grouped.map((section) => (
              <section
                key={section.category}
                className="category-section"
                aria-labelledby={`home-cat-${section.category}`}
              >
                <div className="category-section-head">
                  <h3 id={`home-cat-${section.category}`}>{section.category}</h3>
                  <Link
                    className="category-see-all"
                    to={`/catalog?category=${encodeURIComponent(section.category)}`}
                  >
                    See all {section.category}
                  </Link>
                </div>
                <div className="product-grid">
                  {section.products.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      to={`/product/${product._id}`}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {total > 0 && !loading ? (
          <nav className="pager" aria-label="Home product pages">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages} · {total} listings
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>
    </>
  );
}
