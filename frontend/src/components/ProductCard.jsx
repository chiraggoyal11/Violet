function formatPrice(price) {
  const n = Number(price);
  if (Number.isFinite(n)) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    }).format(n);
  }
  return `$${price}`;
}

export { formatPrice };

export default function ProductCard({ product }) {
  const image = product.ImageUrl || null;
  const sold = product.status === 'sold' || Number(product.stock) === 0;

  return (
    <article className={`product-tile ${sold ? 'is-sold' : ''}`}>
      <div className="product-media">
        {image ? (
          <img src={image} alt={product.Product_Name} loading="lazy" />
        ) : (
          <div className="product-fallback">{product.Product_Name}</div>
        )}
        {sold ? <span className="badge sold">Sold</span> : null}
        {product.category ? (
          <span className="badge category">{product.category}</span>
        ) : null}
      </div>
      <div className="product-body">
        <h3>{product.Product_Name}</h3>
        <p>{product.Product_Detail}</p>
        <div className="product-price">{formatPrice(product.Price)}</div>
      </div>
    </article>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="product-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card" aria-hidden="true">
          <div className="skeleton media" />
          <div className="skeleton line" />
          <div className="skeleton line short" />
        </div>
      ))}
    </div>
  );
}
