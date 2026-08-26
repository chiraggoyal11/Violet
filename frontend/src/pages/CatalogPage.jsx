import { useEffect, useState, useTransition } from 'react';
import { api } from '../api';
import ProductCard from '../components/ProductCard';

export default function CatalogPage() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function load(name = '') {
    setLoading(true);
    setError('');
    try {
      const data = await api.listProducts(name);
      startTransition(() => {
        setProducts(data.product || []);
      });
    } catch (err) {
      setError(err.message || 'Could not load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function onSearch(e) {
    e.preventDefault();
    load(query.trim());
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2>Catalog</h2>
          <p>Search listings by name or browse everything on Violet.</p>
        </div>
        <form className="search-bar" onSubmit={onSearch}>
          <input
            type="search"
            placeholder="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search products"
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            Search
          </button>
        </form>
      </div>

      {error ? <p className="status error">{error}</p> : null}
      {loading || isPending ? <p className="empty">Loading listings…</p> : null}

      {!loading && !error && products.length === 0 ? (
        <p className="empty">No products yet. Be the first to list something.</p>
      ) : null}

      <div className="product-grid">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
}
