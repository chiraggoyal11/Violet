import { useEffect, useState, useTransition } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import ProductCard, { SkeletonGrid } from '../components/ProductCard';

const PAGE_SIZE = 12;
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
];

export default function CatalogPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [status, setStatus] = useState('active');
  const [filters, setFilters] = useState({
    name: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    sort: 'newest',
    status: 'active',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.listProducts({
          ...filters,
          page,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;
        startTransition(() => {
          setProducts(data.product || []);
          setTotalPages(data.totalPages || 1);
          setTotal(data.total || 0);
          if (data.categories) setCategories(data.categories);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not load products');
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  function applyFilters(e) {
    e.preventDefault();
    setPage(1);
    setFilters({
      name: query.trim(),
      category,
      minPrice,
      maxPrice,
      sort,
      status,
    });
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2>Catalog</h2>
          <p>Search, filter, and sort handmade listings on Violet.</p>
        </div>
      </div>

      <form className="filters" onSubmit={applyFilters}>
        <input
          type="search"
          placeholder="Search products"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search products"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Min $"
          value={minPrice}
          onChange={(e) => setMinPrice(e.target.value)}
          aria-label="Minimum price"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Max $"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          aria-label="Maximum price"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Availability"
        >
          <option value="active">Available</option>
          <option value="sold">Sold</option>
          <option value="">All</option>
        </select>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          Apply
        </button>
      </form>

      {error ? <p className="status error">{error}</p> : null}
      {loading || isPending ? <SkeletonGrid /> : null}

      {!loading && !error && products.length === 0 ? (
        <p className="empty">No products match these filters. Try broadening your search.</p>
      ) : null}

      {!loading ? (
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
      ) : null}

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
