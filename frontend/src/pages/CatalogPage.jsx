import { useEffect, useState, useTransition } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard from '../components/ProductCard';

const PAGE_SIZE = 12;

export default function CatalogPage() {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function load(name = activeQuery, nextPage = page) {
    setLoading(true);
    setError('');
    try {
      const data = await api.listProducts({
        name,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      startTransition(() => {
        setProducts(data.product || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        setPage(data.page || nextPage);
      });
    } catch (err) {
      setError(err.message || 'Could not load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(activeQuery, page);
  }, [activeQuery, page]);

  function onSearch(e) {
    e.preventDefault();
    setPage(1);
    setActiveQuery(query.trim());
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
          <Link
            key={product._id}
            to={`/product/${product._id}`}
            className="product-link"
          >
            <ProductCard product={product} />
          </Link>
        ))}
      </div>

      {total > 0 ? (
        <div className="pager">
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
        </div>
      ) : null}
    </section>
  );
}
