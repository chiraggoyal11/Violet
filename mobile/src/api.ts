import { API_URL } from './config';

const AUTH = `${API_URL}/api/violet/auth`;
const PRODUCTS = `${API_URL}/api/violet/products`;
const CART = `${API_URL}/api/violet/cart`;
const ORDERS = `${API_URL}/api/violet/orders`;
const MSG = `${API_URL}/api/violet/messages`;
const FAV = `${API_URL}/api/violet/favorites`;
const REVIEWS = `${API_URL}/api/violet/reviews`;
const NOTES = `${API_URL}/api/violet/notifications`;
const SHOPS = `${API_URL}/api/violet/shops`;
const COUPONS = `${API_URL}/api/violet/coupons`;
const WISHLISTS = `${API_URL}/api/violet/wishlists`;
const OFFERS = `${API_URL}/api/violet/offers`;
const PAYOUTS = `${API_URL}/api/violet/payouts`;
const REPORTS = `${API_URL}/api/violet/reports`;
const ADMIN = `${API_URL}/api/violet/admin`;
const GUEST = `${API_URL}/api/violet/guest`;
const PLATFORM = `${API_URL}/api/violet/platform`;

type Opts = {
  method?: string;
  body?: unknown;
  token?: string | null;
  formData?: boolean;
};

async function request(base: string, path: string, opts: Opts = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body && !opts.formData) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.formData
        ? (opts.body as BodyInit)
        : opts.body
          ? JSON.stringify(opts.body)
          : undefined,
    });
  } catch {
    const err = new Error(
      `Cannot reach Violet API at ${API_URL}. Set EXPO_PUBLIC_API_URL and ensure the server is running.`,
    ) as Error & { status?: number };
    err.status = 0;
    throw err;
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { msg: text.slice(0, 200) || `Request failed (${res.status})` };
    }
  }

  if (!res.ok) {
    const err = new Error(data?.msg || `Request failed (${res.status})`) as Error & {
      status?: number;
      data?: unknown;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  health: () => request(`${API_URL}/api/violet`, '/health'),

  // Auth
  register: (payload: Record<string, unknown>) =>
    request(AUTH, '/register', { method: 'POST', body: payload }),
  login: (payload: Record<string, unknown>) =>
    request(AUTH, '/login', { method: 'POST', body: payload }),
  authConfig: () => request(AUTH, '/config'),
  loginWithGoogle: (credential: string) =>
    request(AUTH, '/google', { method: 'POST', body: { credential } }),
  forgotPassword: (country_code: string, phone_no: string) =>
    request(AUTH, '/forgot-password', {
      method: 'POST',
      body: { country_code, phone_no },
    }),
  resetPassword: (payload: {
    country_code: string;
    phone_no: string;
    otp: string;
    password: string;
  }) => request(AUTH, '/reset-password', { method: 'POST', body: payload }),
  me: (token: string) => request(AUTH, '/', { token }),
  updateProfile: (payload: Record<string, unknown>, token: string) =>
    request(AUTH, '/profile', { method: 'PUT', body: payload, token }),
  updateSettings: (payload: Record<string, unknown>, token: string) =>
    request(AUTH, '/settings', { method: 'PUT', body: payload, token }),

  // Guest
  guestSession: (payload: Record<string, unknown>) =>
    request(GUEST, '/session', { method: 'POST', body: payload }),

  // Products
  listProducts: (opts: Record<string, unknown> = {}) => {
    const params = new URLSearchParams();
    Object.entries(opts).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') params.set(k, String(v));
    });
    return request(PRODUCTS, `/?${params.toString()}`);
  },
  getProduct: (id: string) => request(PRODUCTS, `/detail/${id}`),
  listMyProducts: (userId: string) => request(PRODUCTS, `/user/${userId}`),
  sellerStats: (token: string) => request(PRODUCTS, '/seller/stats', { token }),
  addProduct: (form: FormData, token: string) =>
    request(PRODUCTS, '/', { method: 'POST', body: form, formData: true, token }),
  updateProduct: (id: string, payload: Record<string, unknown>, token: string) =>
    request(PRODUCTS, `/${id}`, { method: 'PUT', body: payload, token }),
  markSold: (id: string, token: string) =>
    request(PRODUCTS, `/${id}/sold`, { method: 'PUT', token }),
  deleteProducts: (ids: string[], token: string) =>
    request(PRODUCTS, '/delete/bulk', { method: 'PUT', body: { id: ids }, token }),

  // Favorites
  listFavorites: (token: string) => request(FAV, '/', { token }),
  favoriteStatus: (productId: string, token: string) =>
    request(FAV, `/${productId}/status`, { token }),
  addFavorite: (productId: string, token: string) =>
    request(FAV, `/${productId}`, { method: 'POST', token }),
  removeFavorite: (productId: string, token: string) =>
    request(FAV, `/${productId}`, { method: 'DELETE', token }),
  toggleFavorite: async (productId: string, token: string) => {
    const st = await request(FAV, `/${productId}/status`, { token });
    if (st?.favorited) return request(FAV, `/${productId}`, { method: 'DELETE', token });
    return request(FAV, `/${productId}`, { method: 'POST', token });
  },

  // Cart
  getCart: (token: string) => request(CART, '/', { token }),
  cartCount: (token: string) => request(CART, '/count', { token }),
  addCartItem: (productId: string, quantity: number, token: string) =>
    request(CART, '/items', {
      method: 'POST',
      body: { product_id: productId, quantity },
      token,
    }),
  updateCartItem: (productId: string, quantity: number, token: string) =>
    request(CART, `/items/${productId}`, { method: 'PUT', body: { quantity }, token }),
  removeCartItem: (productId: string, token: string) =>
    request(CART, `/items/${productId}`, { method: 'DELETE', token }),
  saveForLater: (productId: string, token: string) =>
    request(CART, `/items/${productId}/save-for-later`, { method: 'POST', token }),
  moveSavedToCart: (productId: string, token: string) =>
    request(CART, `/saved/${productId}/move-to-cart`, { method: 'POST', token }),
  removeSavedItem: (productId: string, token: string) =>
    request(CART, `/saved/${productId}`, { method: 'DELETE', token }),

  // Orders / payments
  checkout: (payload: Record<string, unknown>, token: string) =>
    request(ORDERS, '/checkout', { method: 'POST', body: payload, token }),
  paymentConfig: (token: string) => request(ORDERS, '/payments/config', { token }),
  pendingPayment: (token: string) => request(ORDERS, '/pending-payment', { token }),
  paymentStatus: (orderId: string, token: string) =>
    request(ORDERS, `/${orderId}/payment-status`, { token }),
  cancelPayment: (orderId: string, token: string) =>
    request(ORDERS, `/${orderId}/cancel-payment`, { method: 'POST', token }),
  confirmPayment: (orderId: string, payload: Record<string, unknown>, token: string) =>
    request(ORDERS, `/${orderId}/confirm-payment`, { method: 'POST', body: payload, token }),
  listOrders: (token: string) => request(ORDERS, '/', { token }),
  listSales: (token: string) => request(ORDERS, '/sales', { token }),
  updateOrderStatus: (orderId: string, payload: Record<string, unknown>, token: string) =>
    request(ORDERS, `/${orderId}/status`, { method: 'POST', body: payload, token }),
  requestReturn: (orderId: string, reason: string, token: string) =>
    request(ORDERS, `/${orderId}/return`, { method: 'POST', body: { reason }, token }),
  resolveReturn: (orderId: string, decision: string, token: string) =>
    request(ORDERS, `/${orderId}/return/resolve`, {
      method: 'POST',
      body: { decision },
      token,
    }),

  // Reviews
  listReviews: (productId: string) => request(REVIEWS, `/product/${productId}`),
  saveReview: (productId: string, payload: Record<string, unknown>, token: string) =>
    request(REVIEWS, `/product/${productId}`, { method: 'POST', body: payload, token }),
  replyToReview: (reviewId: string, reply: string, token: string) =>
    request(REVIEWS, `/${reviewId}/reply`, { method: 'POST', body: { reply }, token }),

  // Messages
  listConversations: (token: string) => request(MSG, '/', { token }),
  getConversation: (id: string, token: string) => request(MSG, `/${id}/messages`, { token }),
  unreadMessageCount: (token: string) => request(MSG, '/unread-count', { token }),
  sendMessage: (
    payload: { recipient_id: string; body: string; product_id?: string },
    token: string,
  ) => request(MSG, '/', { method: 'POST', body: payload, token }),

  // Notifications
  listNotifications: (token: string) => request(NOTES, '/', { token }),
  unreadNotificationCount: (token: string) => request(NOTES, '/unread-count', { token }),
  markAllNotificationsRead: (token: string) =>
    request(NOTES, '/read-all', { method: 'PUT', token }),
  markNotificationRead: (id: string, token: string) =>
    request(NOTES, `/${id}/read`, { method: 'PUT', token }),

  // Shops / coupons / wishlists / offers / payouts / reports
  getShop: (username: string) => request(SHOPS, `/${encodeURIComponent(username)}`),
  validateCoupon: (code: string, subtotal: number, token: string) =>
    request(COUPONS, '/validate', { method: 'POST', body: { code, subtotal }, token }),
  getWishlist: (token: string) => request(WISHLISTS, '/mine', { token }),
  addWishlistItem: (productId: string, token: string) =>
    request(WISHLISTS, '/mine/items', {
      method: 'POST',
      body: { product_id: productId },
      token,
    }),
  removeWishlistItem: (productId: string, token: string) =>
    request(WISHLISTS, `/mine/items/${productId}`, { method: 'DELETE', token }),
  getSharedWishlist: (shareToken: string) =>
    request(WISHLISTS, `/shared/${encodeURIComponent(shareToken)}`),
  createOffer: (payload: Record<string, unknown>, token: string) =>
    request(OFFERS, '/', { method: 'POST', body: payload, token }),
  updateOffer: (id: string, payload: Record<string, unknown>, token: string) =>
    request(OFFERS, `/${id}`, { method: 'PATCH', body: payload, token }),
  listOffers: (token: string) => request(OFFERS, '/mine', { token }),
  getPayouts: (token: string) => request(PAYOUTS, '/mine', { token }),
  requestPayout: (payload: Record<string, unknown>, token: string) =>
    request(PAYOUTS, '/request', { method: 'POST', body: payload, token }),
  reportTarget: (payload: Record<string, unknown>, token: string) =>
    request(REPORTS, '/', { method: 'POST', body: payload, token }),
  blockUser: (userId: string, token: string) =>
    request(REPORTS, `/block/${userId}`, { method: 'POST', token }),

  // Admin
  listAdminOverview: (token: string) => request(ADMIN, '/overview', { token }),
  listAdminUsers: (q: string, token: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString();
    return request(ADMIN, `/users${qs ? `?${qs}` : ''}`, { token });
  },
  listAdminReports: (token: string) => request(ADMIN, '/reports', { token }),
  patchAdminUser: (id: string, payload: Record<string, unknown>, token: string) =>
    request(ADMIN, `/users/${id}`, { method: 'PATCH', body: payload, token }),
  patchAdminReport: (id: string, payload: Record<string, unknown>, token: string) =>
    request(ADMIN, `/reports/${id}`, { method: 'PATCH', body: payload, token }),

  // Platform
  getCurrencyRates: () => request(PLATFORM, '/rates'),
};

export default api;
