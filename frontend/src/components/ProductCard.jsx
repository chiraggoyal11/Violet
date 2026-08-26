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

  return (
    <article className="product-tile">
      <div className="product-media">
        {image ? (
          <img src={image} alt={product.Product_Name} loading="lazy" />
        ) : (
          <div className="product-fallback">{product.Product_Name}</div>
        )}
      </div>
      <div className="product-body">
        <h3>{product.Product_Name}</h3>
        <p>{product.Product_Detail}</p>
        <div className="product-price">{formatPrice(product.Price)}</div>
      </div>
    </article>
  );
}
