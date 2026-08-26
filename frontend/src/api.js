const AUTH_BASE = '/api/violet/auth';
const PRODUCT_BASE = '/api/violet/products';
const FAV_BASE = '/api/violet/favorites';
const CART_BASE = '/api/violet/cart';
const ORDER_BASE = '/api/violet/orders';
const REVIEW_BASE = '/api/violet/reviews';

async function request(base, path, { method = 'GET', body, token, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: formData ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { msg: text };
    }
  }

  if (!res.ok) {
    const err = new Error(data?.msg || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

/** Compress/resize image in the browser before upload (max edge 1600px, JPEG ~0.82). */
export async function compressImage(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  if (!file || !file.type?.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );
  if (!blob) return file;
  const name = file.name.replace(/\.\w+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

export const api = {
  register: (payload) =>
    request(AUTH_BASE, '/register', { method: 'POST', body: payload }),
  login: (payload) =>
    request(AUTH_BASE, '/login', { method: 'POST', body: payload }),
  me: (token) => request(AUTH_BASE, '/', { token }),
  updateProfile: (payload, token) =>
    request(AUTH_BASE, '/profile', { method: 'PUT', body: payload, token }),

  listProducts: (opts = {}) => {
    const params = new URLSearchParams();
    Object.entries(opts).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') params.set(k, String(v));
    });
    return request(PRODUCT_BASE, `/?${params.toString()}`);
  },
  getProduct: (id) => request(PRODUCT_BASE, `/detail/${id}`),
  listMyProducts: (userId) => request(PRODUCT_BASE, `/user/${userId}`),
  sellerStats: (token) => request(PRODUCT_BASE, '/seller/stats', { token }),
  addProduct: async ({ token, name, detail, price, category, stock, imageFile }) => {
    const form = new FormData();
    form.append('Product_Name', name);
    form.append('Product_Detail', detail);
    form.append('Price', price);
    if (category) form.append('category', category);
    if (stock !== undefined) form.append('stock', String(stock));
    if (imageFile) {
      const compressed = await compressImage(imageFile);
      form.append('Product_Image', compressed);
    }
    return request(PRODUCT_BASE, '/', {
      method: 'POST',
      body: form,
      formData: true,
      token,
    });
  },
  updateProduct: (id, payload, token) =>
    request(PRODUCT_BASE, `/${id}`, { method: 'PUT', body: payload, token }),
  markSold: (id, token) =>
    request(PRODUCT_BASE, `/${id}/sold`, { method: 'PUT', token }),
  deleteProducts: (ids, token) =>
    request(PRODUCT_BASE, '/delete/bulk', {
      method: 'PUT',
      body: { id: ids },
      token,
    }),

  listFavorites: (token) => request(FAV_BASE, '/', { token }),
  addFavorite: (productId, token) =>
    request(FAV_BASE, `/${productId}`, { method: 'POST', token }),
  removeFavorite: (productId, token) =>
    request(FAV_BASE, `/${productId}`, { method: 'DELETE', token }),

  getCart: (token) => request(CART_BASE, '/', { token }),
  addToCart: (product_id, token, quantity = 1) =>
    request(CART_BASE, '/items', {
      method: 'POST',
      body: { product_id, quantity },
      token,
    }),
  updateCartItem: (productId, quantity, token) =>
    request(CART_BASE, `/items/${productId}`, {
      method: 'PUT',
      body: { quantity },
      token,
    }),
  removeCartItem: (productId, token) =>
    request(CART_BASE, `/items/${productId}`, { method: 'DELETE', token }),

  checkout: (note, token) =>
    request(ORDER_BASE, '/checkout', { method: 'POST', body: { note }, token }),
  listOrders: (token) => request(ORDER_BASE, '/', { token }),
  listSales: (token) => request(ORDER_BASE, '/sales', { token }),

  listReviews: (productId) => request(REVIEW_BASE, `/product/${productId}`),
  saveReview: (productId, payload, token) =>
    request(REVIEW_BASE, `/product/${productId}`, {
      method: 'POST',
      body: payload,
      token,
    }),
};
