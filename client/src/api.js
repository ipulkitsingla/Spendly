const getToken = () => localStorage.getItem('spendly_token');

/** Base URL for API (production on Vercel). Empty = same-origin / Vite dev proxy. */
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), { ...options, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.message || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/api/auth/me'),
  accounts: () => request('/api/accounts'),
  createAccount: (body) => request('/api/accounts', { method: 'POST', body: JSON.stringify(body) }),
  updateAccount: (id, body) =>
    request(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAccount: (id) => request(`/api/accounts/${id}`, { method: 'DELETE' }),
  transactions: (month, accountId) => {
    const q = new URLSearchParams({ month });
    if (accountId) q.set('accountId', accountId);
    return request(`/api/transactions?${q}`);
  },
  createTransaction: (body) => request('/api/transactions', { method: 'POST', body: JSON.stringify(body) }),
  patchTransaction: (id, body) =>
    request(`/api/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTransaction: (id) => request(`/api/transactions/${id}`, { method: 'DELETE' }),
  /** Reconcile account to a new balance; creates a balance_update transaction */
  updateAccountBalance: ({ accountId, newBalance, date, note }) =>
    request(
      '/api/transactions',
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'balance_update',
          accountId,
          newBalance: Number(newBalance),
          date: date || new Date().toISOString(),
          note: note || '',
        }),
      }
    ),
  pending: (status) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/api/pending${q}`);
  },
  createPending: (body) => request('/api/pending', { method: 'POST', body: JSON.stringify(body) }),
  settlePending: (id, accountId) =>
    request(`/api/pending/${id}/settle`, { method: 'POST', body: JSON.stringify({ accountId }) }),
  patchPending: (id, body) =>
    request(`/api/pending/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deletePending: (id) => request(`/api/pending/${id}`, { method: 'DELETE' }),
  categories: () => request('/api/categories'),
  addCategory: (name) => request('/api/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  statsSummary: (from, to) =>
    request(`/api/stats/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  statsTimeseries: (from, to, bucket) =>
    request(
      `/api/stats/timeseries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=${bucket}`
    ),
};
