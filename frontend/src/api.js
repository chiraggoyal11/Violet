const AUTH_BASE = '/api/violet/auth';
const PRODUCT_BASE = '/api/violet/products';

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

export const api = {
  register: (payload) =>
    request(AUTH_BASE, '/register', { method: 'POST', body: payload }),
  login: (payload) =>
    request(AUTH_BASE, '/login', { method: 'POST', body: payload }),
  me: (token) => request(AUTH_BASE, '/', { token }),
  updateProfile: (payload, token) =>
    request(AUTH_BASE, '/profile', { method: 'PUT', body: payload, token }),
  listProducts: ({ name = '', page = 1, limit = 12 } = {}) => {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    params.set('page', String(page));
    params.set('limit', String(limit));
    return request(PRODUCT_BASE, `/?${params.toString()}`);
  },
  getProduct: (id) => request(PRODUCT_BASE, `/detail/${id}`),
  listMyProducts: (userId) => request(PRODUCT_BASE, `/user/${userId}`),
  addProduct: ({ token, name, detail, price, imageFile }) => {
    const form = new FormData();
    form.append('Product_Name', name);
    form.append('Product_Detail', detail);
    form.append('Price', price);
    if (imageFile) form.append('Product_Image', imageFile);
    return request(PRODUCT_BASE, '/', {
      method: 'POST',
      body: form,
      formData: true,
      token,
    });
  },
  updateProduct: (id, payload, token) =>
    request(PRODUCT_BASE, `/${id}`, { method: 'PUT', body: payload, token }),
  deleteProducts: (ids, token) =>
    request(PRODUCT_BASE, '/delete/bulk', {
      method: 'PUT',
      body: { id: ids },
      token,
    }),
};
