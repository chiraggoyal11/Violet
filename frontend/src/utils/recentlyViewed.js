const STORAGE_KEY = 'violet_recently_viewed';
const MAX_ITEMS = 12;

function readRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function getRecentlyViewed() {
  return readRaw().filter((item) => item && item.id);
}

/** Push a compact product snapshot to the front of recently viewed. */
export function pushRecentlyViewed(product) {
  if (!product?._id) return getRecentlyViewed();
  const entry = {
    id: String(product._id),
    name: product.Product_Name || 'Product',
    price: product.Price,
    image: product.ImageUrls?.[0] || product.ImageUrl || '',
    category: product.category || '',
    viewedAt: Date.now(),
  };
  const next = [entry, ...readRaw().filter((item) => String(item.id) !== entry.id)].slice(
    0,
    MAX_ITEMS,
  );
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  return next;
}

export function clearRecentlyViewed() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
