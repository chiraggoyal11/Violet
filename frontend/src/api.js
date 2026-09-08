const AUTH_BASE = '/api/violet/auth';
const PRODUCT_BASE = '/api/violet/products';
const FAV_BASE = '/api/violet/favorites';
const CART_BASE = '/api/violet/cart';
const ORDER_BASE = '/api/violet/orders';
const REVIEW_BASE = '/api/violet/reviews';
const MSG_BASE = '/api/violet/messages';
const NOTE_BASE = '/api/violet/notifications';
const SHOP_BASE = '/api/violet/shops';
const COUPON_BASE = '/api/violet/coupons';
const ADMIN_BASE = '/api/violet/admin';
const WISHLIST_BASE = '/api/violet/wishlists';
const PAYOUT_BASE = '/api/violet/payouts';
const OFFER_BASE = '/api/violet/offers';
const PLATFORM_BASE = '/api/violet/platform';
const GUEST_BASE = '/api/violet/guest';
const REPORT_BASE = '/api/violet/reports';

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
  updateAvatar: async (file, token) => {
    const compressed = await compressImage(file, { maxEdge: 800, quality: 0.85 });
    const form = new FormData();
    form.append('avatar', compressed);
    return request(AUTH_BASE, '/avatar', {
      method: 'PUT',
      body: form,
      formData: true,
      token,
    });
  },

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
  addProduct: async ({ token, name, detail, price, category, colour, stock, imageFiles = [] }) => {
    const form = new FormData();
    form.append('Product_Name', name);
    form.append('Product_Detail', detail);
    form.append('Price', price);
    if (category) form.append('category', category);
    if (colour) form.append('colour', colour);
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
  favoriteStatus: (productId, token) =>
    request(FAV_BASE, `/${productId}/status`, { token }),
  addFavorite: (productId, token) =>
    request(FAV_BASE, `/${productId}`, { method: 'POST', token }),
  removeFavorite: (productId, token) =>
    request(FAV_BASE, `/${productId}`, { method: 'DELETE', token }),

  getCart: (token) => request(CART_BASE, '/', { token }),
  cartCount: (token) => request(CART_BASE, '/count', { token }),
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
  saveCartItemForLater: (productId, token) =>
    request(CART_BASE, `/items/${productId}/save-for-later`, {
      method: 'POST',
      token,
    }),
  moveSavedToCart: (productId, token) =>
    request(CART_BASE, `/saved/${productId}/move-to-cart`, {
      method: 'POST',
      token,
    }),
  removeSavedItem: (productId, token) =>
    request(CART_BASE, `/saved/${productId}`, { method: 'DELETE', token }),

  checkout: (payload, token) =>
    request(ORDER_BASE, '/checkout', {
      method: 'POST',
      body: typeof payload === 'string' ? { note: payload } : payload,
      token,
    }),
  paymentConfig: (token) => request(ORDER_BASE, '/payments/config', { token }),
  pendingPayment: (token) => request(ORDER_BASE, '/pending-payment', { token }),
  paymentStatus: (orderId, token) =>
    request(ORDER_BASE, `/${orderId}/payment-status`, { token }),
  cancelPayment: (orderId, token) =>
    request(ORDER_BASE, `/${orderId}/cancel-payment`, {
      method: 'POST',
      token,
    }),
  confirmPayment: (orderId, payload, token) =>
    request(ORDER_BASE, `/${orderId}/confirm-payment`, {
      method: 'POST',
      body: payload,
      token,
    }),
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
  unreadMessageCount: (token) => request(MSG_BASE, '/unread-count', { token }),
  sendMessage: (payload, token) =>
    request(MSG_BASE, '/', { method: 'POST', body: payload, token }),

  listNotifications: (token) => request(NOTE_BASE, '/', { token }),
  unreadNotificationCount: (token) => request(NOTE_BASE, '/unread-count', { token }),
  markAllNotificationsRead: (token) =>
    request(NOTE_BASE, '/read-all', { method: 'PUT', token }),
  markNotificationRead: (id, token) =>
    request(NOTE_BASE, `/${id}/read`, { method: 'PUT', token }),

  getShop: (username) => request(SHOP_BASE, `/${encodeURIComponent(username)}`),

  validateCoupon: (code, subtotal, token) =>
    request(COUPON_BASE, '/validate', {
      method: 'POST',
      body: { code, subtotal },
      token,
    }),

  listAdminOverview: (token) => request(ADMIN_BASE, '/overview', { token }),
  listAdminUsers: (q, token) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString();
    return request(ADMIN_BASE, `/users${qs ? `?${qs}` : ''}`, { token });
  },
  listAdminReports: (token) => request(ADMIN_BASE, '/reports', { token }),
  patchAdminUser: (id, payload, token) =>
    request(ADMIN_BASE, `/users/${id}`, { method: 'PATCH', body: payload, token }),
  patchAdminReport: (id, payload, token) =>
    request(ADMIN_BASE, `/reports/${id}`, { method: 'PATCH', body: payload, token }),
  patchAdminProduct: (id, payload, token) =>
    request(ADMIN_BASE, `/products/${id}`, { method: 'PATCH', body: payload, token }),
  deleteAdminReview: (id, token) =>
    request(ADMIN_BASE, `/reviews/${id}`, { method: 'DELETE', token }),

  getWishlist: (token) => request(WISHLIST_BASE, '/mine', { token }),
  addWishlistItem: (productId, token) =>
    request(WISHLIST_BASE, '/mine/items', {
      method: 'POST',
      body: { product_id: productId },
      token,
    }),
  removeWishlistItem: (productId, token) =>
    request(WISHLIST_BASE, `/mine/items/${productId}`, { method: 'DELETE', token }),
  getSharedWishlist: (shareToken) =>
    request(WISHLIST_BASE, `/shared/${encodeURIComponent(shareToken)}`),

  getPayouts: (token) => request(PAYOUT_BASE, '/mine', { token }),
  requestPayout: (payload, token) =>
    request(PAYOUT_BASE, '/request', { method: 'POST', body: payload, token }),

  createOffer: (payload, token) =>
    request(OFFER_BASE, '/', { method: 'POST', body: payload, token }),
  updateOffer: (id, payload, token) =>
    request(OFFER_BASE, `/${id}`, { method: 'PATCH', body: payload, token }),
  listOffers: (token) => request(OFFER_BASE, '/mine', { token }),

  getCurrencyRates: () => request(PLATFORM_BASE, '/rates'),
  subscribePush: (subscription, token) =>
    request(PLATFORM_BASE, '/subscribe', {
      method: 'POST',
      body: { subscription },
      token,
    }),
  unsubscribePush: (token) =>
    request(PLATFORM_BASE, '/subscribe', { method: 'DELETE', token }),
  getVapidKey: () => request(PLATFORM_BASE, '/vapid-public-key'),

  guestSession: (payload) =>
    request(GUEST_BASE, '/session', { method: 'POST', body: payload }),

  updateOrderStatus: (orderId, payload, token) =>
    request(ORDER_BASE, `/${orderId}/status`, {
      method: 'POST',
      body: payload,
      token,
    }),
  requestReturn: (orderId, reason, token) =>
    request(ORDER_BASE, `/${orderId}/return`, {
      method: 'POST',
      body: { reason },
      token,
    }),
  resolveReturn: (orderId, decision, token) =>
    request(ORDER_BASE, `/${orderId}/return/resolve`, {
      method: 'POST',
      body: { decision },
      token,
    }),

  replyToReview: (reviewId, reply, token) =>
    request(REVIEW_BASE, `/${reviewId}/reply`, {
      method: 'POST',
      body: { reply },
      token,
    }),

  reorderProductImages: (productId, images, token) =>
    request(PRODUCT_BASE, `/${productId}/images/order`, {
      method: 'PUT',
      body: { images },
      token,
    }),

  reportTarget: (payload, token) =>
    request(REPORT_BASE, '/', { method: 'POST', body: payload, token }),
  blockUser: (userId, token) =>
    request(REPORT_BASE, `/block/${userId}`, { method: 'POST', token }),
  unblockUser: (userId, token) =>
    request(REPORT_BASE, `/block/${userId}`, { method: 'DELETE', token }),
};
