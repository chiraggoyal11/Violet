const AUTH_BASE = '/api/violet/auth';
const PRODUCT_BASE = '/api/violet/products';
const FAV_BASE = '/api/violet/favorites';
const CART_BASE = '/api/violet/cart';
const ORDER_BASE = '/api/violet/orders';
const REVIEW_BASE = '/api/violet/reviews';
const MSG_BASE = '/api/violet/messages';
const NOTE_BASE = '/api/violet/notifications';

const GATEWAY_STATUSES = new Set([502, 503, 504]);
const WAKE_RETRY_MS = [0, 2000, 4000, 8000, 12000, 16000, 20000];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessageFromResponse(res, text, data) {
  const html = Boolean(text && /<!DOCTYPE html|<html/i.test(text));
  if (GATEWAY_STATUSES.has(res.status) || html) {
    return 'Server is waking up — wait about 30 seconds, then try again.';
  }
  if (res.status === 503 && data?.msg) {
    return data.msg;
  }
  if (data?.msg && !/<html|@font-face|Roobert/i.test(String(data.msg))) {
    return data.msg;
  }
  if (res.status === 429) return 'Too many requests — try again in a few minutes.';
  return `Request failed (${res.status})`;
}

async function request(base, path, { method = 'GET', body, token, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !formData) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: formData ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error(
      'Cannot reach the server — it may be waking up. Wait ~30 seconds and try again.',
    );
    err.status = 0;
    throw err;
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const plain = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const staleRoute = /cannot (get|post|put|delete)/i.test(plain);
      data = {
        msg: staleRoute
          ? 'API server is out of date — restart it (npm start) and try again.'
          : plain.slice(0, 200) || `Request failed (${res.status})`,
      };
    }
  }

  if (!res.ok) {
    const err = new Error(errorMessageFromResponse(res, text, data));
    err.status = res.status;
    err.data = data;
    err.retryable =
      GATEWAY_STATUSES.has(res.status) ||
      res.status === 503 ||
      Boolean(text && /<!DOCTYPE html|<html/i.test(text));
    throw err;
  }

  return data;
}

async function requestWithRetry(base, path, options = {}, delays = WAKE_RETRY_MS) {
  let lastError;
  for (let i = 0; i < delays.length; i += 1) {
    if (delays[i]) await sleep(delays[i]);
    try {
      return await request(base, path, options);
    } catch (err) {
      lastError = err;
      const retryable =
        err.retryable || err.status === 0 || GATEWAY_STATUSES.has(err.status);
      if (!retryable || i === delays.length - 1) throw err;
    }
  }
  throw lastError;
}

/** Ping health until Render free tier finishes waking (or give up). */
export async function wakeApi() {
  for (const delay of WAKE_RETRY_MS) {
    if (delay) await sleep(delay);
    try {
      const res = await fetch('/api/violet/health');
      if (res.ok) return true;
    } catch {
      /* keep trying */
    }
  }
  return false;
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
    requestWithRetry(AUTH_BASE, '/register', { method: 'POST', body: payload }),
  login: (payload) =>
    requestWithRetry(AUTH_BASE, '/login', { method: 'POST', body: payload }),
  authConfig: () => request(AUTH_BASE, '/config'),
  loginWithGoogle: (credential) =>
    requestWithRetry(AUTH_BASE, '/google', {
      method: 'POST',
      body: { credential },
    }),
  forgotPassword: ({ country_code, phone_no }) =>
    request(AUTH_BASE, '/forgot-password', {
      method: 'POST',
      body: { country_code, phone_no },
    }),
  resetPassword: (payload) =>
    request(AUTH_BASE, '/reset-password', { method: 'POST', body: payload }),
  me: (token) => request(AUTH_BASE, '/', { token }),
  updateProfile: (payload, token) =>
    request(AUTH_BASE, '/profile', { method: 'PUT', body: payload, token }),
  updateSettings: (payload, token) =>
    request(AUTH_BASE, '/settings', { method: 'PUT', body: payload, token }),

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
  addProduct: async ({ token, name, detail, price, category, stock, imageFiles = [] }) => {
    const form = new FormData();
    form.append('Product_Name', name);
    form.append('Product_Detail', detail);
    form.append('Price', price);
    if (category) form.append('category', category);
    if (stock !== undefined) form.append('stock', String(stock));
    for (const file of imageFiles) {
      const compressed = await compressImage(file);
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

  listConversations: (token) => request(MSG_BASE, '/', { token }),
  getConversation: (id, token) => request(MSG_BASE, `/${id}/messages`, { token }),
  sendMessage: (payload, token) =>
    request(MSG_BASE, '/', { method: 'POST', body: payload, token }),

  listNotifications: (token) => request(NOTE_BASE, '/', { token }),
  unreadNotificationCount: (token) => request(NOTE_BASE, '/unread-count', { token }),
  markAllNotificationsRead: (token) =>
    request(NOTE_BASE, '/read-all', { method: 'PUT', token }),
  markNotificationRead: (id, token) =>
    request(NOTE_BASE, `/${id}/read`, { method: 'PUT', token }),
};
