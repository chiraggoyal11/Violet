import { useEffect, useMemo, useState, useTransition } from 'react';
import { api } from '../api';
import ProductCard, { SkeletonGrid } from '../components/ProductCard';

const PAGE_SIZE = 12;
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Popular' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const emptyDraft = {
  category: '',
  colour: '',
  minPrice: '',
  maxPrice: '',
  status: 'active',
};

export default function CatalogPage() {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [sort, setSort] = useState('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    ...emptyDraft,
    sort: 'newest',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [colours, setColours] = useState([]);
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
          if (data.colours) setColours(data.colours);
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

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.category) n += 1;
    if (filters.colour) n += 1;
    if (filters.minPrice !== '') n += 1;
    if (filters.maxPrice !== '') n += 1;
    if (filters.status && filters.status !== 'active') n += 1;
    return n;
  }, [filters]);

  function applySearch(e) {
    e.preventDefault();
    setPage(1);
    setFilters((prev) => ({ ...prev, name: query.trim() }));
  }

  function applyPanelFilters(e) {
    e.preventDefault();
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      name: query.trim(),
      category: draft.category,
      colour: draft.colour,
      minPrice: draft.minPrice,
      maxPrice: draft.maxPrice,
      status: draft.status,
    }));
    setFiltersOpen(false);
  }

  function clearPanelFilters() {
    setDraft(emptyDraft);
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      category: '',
      colour: '',
      minPrice: '',
      maxPrice: '',
      status: 'active',
    }));
    setFiltersOpen(false);
  }

  function onSortChange(value) {
    setSort(value);
    setPage(1);
    setFilters((prev) => ({ ...prev, sort: value }));
  }

  function openFilters() {
    setDraft({
      category: filters.category || '',
      colour: filters.colour || '',
      minPrice: filters.minPrice || '',
      maxPrice: filters.maxPrice || '',
      status: filters.status || 'active',
    });
    setFiltersOpen(true);
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2>Home</h2>
          <p>Browse handmade listings — search, filter, and sort what you love.</p>
        </div>
      </div>

      <div className="home-toolbar">
        <form className="home-search" onSubmit={applySearch}>
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

        <div className="home-toolbar-actions">
          <button
            type="button"
            className={`btn btn-secondary filter-trigger${activeFilterCount ? ' has-filters' : ''}`}
            onClick={openFilters}
            aria-expanded={filtersOpen}
          >
            Filters
            {activeFilterCount ? (
              <span className="filter-count">{activeFilterCount}</span>
            ) : null}
          </button>
          <label className="sort-control">
            <span className="visually-hidden">Sort</span>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value)}
              aria-label="Sort products"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filtersOpen ? (
        <div className="filter-overlay" role="presentation" onClick={() => setFiltersOpen(false)}>
          <div
            className="filter-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-panel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="filter-panel-head">
              <h3 id="filter-panel-title">Filters</h3>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close filters"
                onClick={() => setFiltersOpen(false)}
              >
                ×
              </button>
            </div>
            <form className="filter-panel-form" onSubmit={applyPanelFilters}>
              <div className="form-field">
                <label htmlFor="filter-category">Category</label>
                <select
                  id="filter-category"
                  value={draft.category}
                  onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                >
                  <option value="">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="filter-colour">Colour</label>
                <select
                  id="filter-colour"
                  value={draft.colour}
                  onChange={(e) => setDraft((d) => ({ ...d, colour: e.target.value }))}
                >
                  <option value="">All colours</option>
                  {colours.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="filter-min">Min price</label>
                  <input
                    id="filter-min"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={draft.minPrice}
                    onChange={(e) => setDraft((d) => ({ ...d, minPrice: e.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="filter-max">Max price</label>
                  <input
                    id="filter-max"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Any"
                    value={draft.maxPrice}
                    onChange={(e) => setDraft((d) => ({ ...d, maxPrice: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-field">
                <label htmlFor="filter-status">Availability</label>
                <select
                  id="filter-status"
                  value={draft.status}
                  onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                >
                  <option value="active">Available</option>
                  <option value="sold">Sold</option>
                  <option value="">All</option>
                </select>
              </div>
              <div className="filter-panel-actions">
                <button type="button" className="btn btn-secondary" onClick={clearPanelFilters}>
                  Clear
                </button>
                <button type="submit" className="btn btn-primary">
                  Apply filters
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {error ? <p className="status error">{error}</p> : null}

      {loading || isPending ? (
        <SkeletonGrid />
      ) : products.length === 0 ? (
        <p className="empty">No products match these filters. Try broadening your search.</p>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} to={`/product/${product._id}`} />
          ))}
        </div>
      )}

      {total > 0 && !loading && !isPending ? (
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
