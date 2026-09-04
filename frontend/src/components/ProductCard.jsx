import { Link } from 'react-router-dom';

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

export default function ProductCard({ product, to }) {
  const image = product.ImageUrls?.[0] || product.ImageUrl || null;
  const sold = product.status === 'sold' || Number(product.stock) === 0;
  const meta = [product.category, product.colour !== 'Other' ? product.colour : null]
    .filter(Boolean)
    .join(' · ');

  const card = (
    <article className={`product-tile${sold ? ' is-sold' : ''}`}>
      <div className="product-media">
        {image ? (
          <img src={image} alt={product.Product_Name} loading="lazy" />
        ) : (
          <div className="product-fallback">{product.Product_Name}</div>
        )}
        {sold ? <span className="badge sold">Sold</span> : null}
      </div>
      <div className="product-body">
        {meta ? <p className="product-meta">{meta}</p> : null}
        <h3>{product.Product_Name}</h3>
        <p>{product.Product_Detail}</p>
        <div className="product-price">{formatPrice(product.Price)}</div>
      </div>
    </article>
  );

  if (to) {
    return (
      <Link to={to} className="product-link" aria-label={`View ${product.Product_Name}`}>
        {card}
      </Link>
    );
  }

  return card;
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
