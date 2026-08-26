const API_BASE = '/api/violet/auth';

async function request(path, { method = 'GET', body, token, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = token;
  if (body && !formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
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
  register: (payload) => request('/register', { method: 'POST', body: payload }),
  login: (payload) => request('/login', { method: 'POST', body: payload }),
  me: (token) => request('/', { token }),
  listProducts: (name) => {
    const q = name ? `?name=${encodeURIComponent(name)}` : '';
    return request(`/get${q}`);
  },
  listMyProducts: (userId) => request(`/get/${userId}`),
  addProduct: ({ userId, name, detail, price, imageFile }) => {
    const form = new FormData();
    form.append('user_id', userId);
    form.append('Product_Name', name);
    form.append('Product_Detail', detail);
    form.append('Price', price);
    if (imageFile) form.append('Product_Image', imageFile);
    return request('/add', { method: 'POST', body: form, formData: true });
  },
  updateProduct: (id, payload) =>
    request(`/update/${id}`, { method: 'PUT', body: payload }),
  deleteProducts: (ids) =>
    request('/delete', { method: 'PUT', body: { id: ids } }),
};
