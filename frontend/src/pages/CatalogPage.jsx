import { useEffect, useMemo, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import EmptyState from '../components/EmptyState';
import ProductCard, { SkeletonGrid } from '../components/ProductCard';

const PAGE_SIZE = 12;
const ALL_PAGE_SIZE = 24;
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

function pageWindow(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [draft, setDraft] = useState({ ...emptyDraft, category: initialCategory });
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    name: searchParams.get('q') || '',
    ...emptyDraft,
    category: initialCategory,
    sort: searchParams.get('sort') || 'newest',
  });
  const [page, setPage] = useState(initialPage);
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

  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.name) next.set('q', filters.name);
    if (filters.category) next.set('category', filters.category);
    if (filters.sort && filters.sort !== 'newest') next.set('sort', filters.sort);
    if (page > 1) next.set('page', String(page));
    setSearchParams(next, { replace: true });
  }, [filters.name, filters.category, filters.sort, page, setSearchParams]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.category) n += 1;
    if (filters.colour) n += 1;
    if (filters.minPrice !== '') n += 1;
    if (filters.maxPrice !== '') n += 1;
    if (filters.status && filters.status !== 'active') n += 1;
    return n;
  }, [filters]);

  const grouped = useMemo(
    () => groupByCategory(products, categories.length ? categories : ['Home', 'Fashion', 'Art', 'Food', 'Other']),
    [products, categories],
  );

  const showGrouped = !filters.category && !filters.name && !filters.colour && filters.minPrice === '' && filters.maxPrice === '';

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

  function selectCategory(category) {
    setDraft((d) => ({ ...d, category }));
    setPage(1);
    setFilters((prev) => ({ ...prev, category }));
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

  function goToPage(nextPage) {
    setPage(Math.min(Math.max(1, nextPage), totalPages || 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const pagerPages = pageWindow(page, totalPages);

  return (
    <section className="section home-section">
      <div className="home-sticky-bar">
        <div className="section-heading home-heading">
          <div>
            <p className="section-kicker">Shop</p>
            <h2>Handmade finds</h2>
            <p>Browse every category, then page through more listings.</p>
          </div>
        </div>

        <div className="home-toolbar">
          <form className="home-search" onSubmit={applySearch}>
            <input
              type="search"
              placeholder="Search handmade goods"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
            />
            <button className="btn btn-accent" type="submit" disabled={loading}>
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

        <div className="category-chip-row" role="tablist" aria-label="Product categories">
          <button
            type="button"
            role="tab"
            aria-selected={!filters.category}
            className={`category-chip${!filters.category ? ' active' : ''}`}
            onClick={() => selectCategory('')}
          >
            All
          </button>
          {(categories.length ? categories : ['Home', 'Fashion', 'Art', 'Food', 'Other']).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={filters.category === c}
              className={`category-chip${filters.category === c ? ' active' : ''}`}
              onClick={() => selectCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {activeFilterCount || filters.name ? (
          <div className="active-chips" aria-label="Active filters">
            {filters.name ? (
              <button
                type="button"
                className="active-chip"
                onClick={() => {
                  setQuery('');
                  setPage(1);
                  setFilters((prev) => ({ ...prev, name: '' }));
                }}
              >
                Search: {filters.name} ×
              </button>
            ) : null}
            {filters.category ? (
              <button type="button" className="active-chip" onClick={() => selectCategory('')}>
                {filters.category} ×
              </button>
            ) : null}
            {filters.colour ? (
              <button type="button" className="active-chip" onClick={openFilters}>
                {filters.colour}
              </button>
            ) : null}
            {filters.minPrice !== '' || filters.maxPrice !== '' ? (
              <button type="button" className="active-chip" onClick={openFilters}>
                Price
                {filters.minPrice !== '' ? ` ≥ ${filters.minPrice}` : ''}
                {filters.maxPrice !== '' ? ` ≤ ${filters.maxPrice}` : ''}
              </button>
            ) : null}
            {filters.status && filters.status !== 'active' ? (
              <button type="button" className="active-chip" onClick={openFilters}>
                {filters.status === 'sold' ? 'Sold' : 'All availability'}
              </button>
            ) : null}
          </div>
        ) : null}
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
        <EmptyState
          title="No matches"
          body="Try clearing filters or searching a different material, colour, or maker."
        />
      ) : showGrouped ? (
        <div className="category-sections">
          {grouped.map((section) => (
            <section key={section.category} className="category-section" aria-labelledby={`cat-${section.category}`}>
              <div className="category-section-head">
                <h3 id={`cat-${section.category}`}>{section.category}</h3>
                <button
                  type="button"
                  className="category-see-all"
                  onClick={() => selectCategory(section.category)}
                >
                  See all {section.category}
                </button>
              </div>
              <div className="product-grid">
                {section.products.map((product) => (
                  <ProductCard key={product._id} product={product} to={`/product/${product._id}`} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard key={product._id} product={product} to={`/product/${product._id}`} />
          ))}
        </div>
      )}

      {total > 0 && !loading && !isPending ? (
        <nav className="pager pager-numbered" aria-label="Product pages">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <div className="pager-pages">
            {pagerPages.map((p, index) => {
              const prev = pagerPages[index - 1];
              const showEllipsis = prev && p - prev > 1;
              return (
                <span key={p} className="pager-page-wrap">
                  {showEllipsis ? <span className="pager-ellipsis">…</span> : null}
                  <button
                    type="button"
                    className={`pager-page${p === page ? ' active' : ''}`}
                    aria-current={p === page ? 'page' : undefined}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                </span>
              );
            })}
          </div>
          <span className="pager-meta">
            Page {page} of {totalPages} · {total} listings
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={page >= totalPages || loading}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}
