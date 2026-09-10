import { API_URL } from './config';

const AUTH_BASE = `${API_URL}/api/violet/auth`;
const PRODUCT_BASE = `${API_URL}/api/violet/products`;
const CART_BASE = `${API_URL}/api/violet/cart`;
const ORDER_BASE = `${API_URL}/api/violet/orders`;
const MSG_BASE = `${API_URL}/api/violet/messages`;
const FAV_BASE = `${API_URL}/api/violet/favorites`;

type RequestOpts = {
  method?: string;
  body?: unknown;
  token?: string | null;
  formData?: boolean;
};

async function request(base: string, path: string, opts: RequestOpts = {}) {
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
  register: (payload: Record<string, unknown>) =>
    request(AUTH_BASE, '/register', { method: 'POST', body: payload }),
  login: (payload: Record<string, unknown>) =>
    request(AUTH_BASE, '/login', { method: 'POST', body: payload }),
  me: (token: string) => request(AUTH_BASE, '/', { token }),
  updateProfile: (payload: Record<string, unknown>, token: string) =>
    request(AUTH_BASE, '/profile', { method: 'PUT', body: payload, token }),

  listProducts: (opts: Record<string, unknown> = {}) => {
    const params = new URLSearchParams();
    Object.entries(opts).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') params.set(k, String(v));
    });
    return request(PRODUCT_BASE, `/?${params.toString()}`);
  },
  getProduct: (id: string) => request(PRODUCT_BASE, `/detail/${id}`),

  getCart: (token: string) => request(CART_BASE, '/', { token }),
  cartCount: (token: string) => request(CART_BASE, '/count', { token }),
  addCartItem: (productId: string, quantity: number, token: string) =>
    request(CART_BASE, '/items', {
      method: 'POST',
      body: { product_id: productId, quantity },
      token,
    }),
  updateCartItem: (productId: string, quantity: number, token: string) =>
    request(CART_BASE, `/items/${productId}`, {
      method: 'PUT',
      body: { quantity },
      token,
    }),
  removeCartItem: (productId: string, token: string) =>
    request(CART_BASE, `/items/${productId}`, { method: 'DELETE', token }),

  checkout: (payload: Record<string, unknown>, token: string) =>
    request(ORDER_BASE, '/checkout', { method: 'POST', body: payload, token }),
  paymentConfig: (token: string) => request(ORDER_BASE, '/payments/config', { token }),
  listOrders: (token: string) => request(ORDER_BASE, '/', { token }),
  cancelPayment: (orderId: string, token: string) =>
    request(ORDER_BASE, `/${orderId}/cancel-payment`, { method: 'POST', token }),
  paymentStatus: (orderId: string, token: string) =>
    request(ORDER_BASE, `/${orderId}/payment-status`, { token }),

  listConversations: (token: string) => request(MSG_BASE, '/', { token }),
  getConversation: (id: string, token: string) =>
    request(MSG_BASE, `/${id}/messages`, { token }),
  sendMessage: (
    payload: { recipient_id: string; body: string; product_id?: string },
    token: string,
  ) => request(MSG_BASE, '/', { method: 'POST', body: payload, token }),

  toggleFavorite: (productId: string, token: string) =>
    request(FAV_BASE, `/${productId}`, { method: 'POST', token }),
  listFavorites: (token: string) => request(FAV_BASE, '/', { token }),
};

export default api;
