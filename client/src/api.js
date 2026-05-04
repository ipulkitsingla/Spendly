import { rawRequest } from './api/requestCore.js';
import {
  applyCreateTransactionToCaches,
  applyDeleteTransactionToCaches,
  applyPatchTransactionToCaches,
  buildLocalTransaction,
  bundleCacheKey,
  findTransactionInCaches,
  invalidateBundlesForMonth,
} from './offline/cacheMutations.js';
import { cacheGet, cacheInvalidateBundles, cachePut, outboxAdd } from './offline/store.js';
import { browserOnline, isOfflineFetchError } from './offline/networkState.js';
import { monthKey } from './utils/format.js';

function monthStrFromTxDate(iso) {
  return monthKey(new Date(iso));
}

async function writeGetCaches(path, data) {
  if (path.startsWith('/api/transactions?')) {
    const u = new URL(path, 'http://spendly.local');
    const month = u.searchParams.get('month');
    const aid = u.searchParams.get('accountId') || '';
    if (month && data?.transactions) await cachePut(bundleCacheKey(month, aid || null), data);
  }
  if (path === '/api/accounts' && Array.isArray(data)) await cachePut('accounts', data);
  if (path === '/api/categories' && Array.isArray(data)) await cachePut('categories', data);
  if (path.startsWith('/api/pending')) {
    const u = new URL(path, 'http://spendly.local');
    if (!u.searchParams.get('status') && Array.isArray(data)) await cachePut('pending:list', data);
  }
}

async function readGetCaches(path) {
  if (path.startsWith('/api/transactions?')) {
    const u = new URL(path, 'http://spendly.local');
    const month = u.searchParams.get('month');
    const aid = u.searchParams.get('accountId') || '';
    if (month) return cacheGet(bundleCacheKey(month, aid || null));
  }
  if (path === '/api/accounts') return cacheGet('accounts');
  if (path === '/api/categories') return cacheGet('categories');
  if (path.startsWith('/api/pending')) {
    const list = await cacheGet('pending:list');
    if (!Array.isArray(list)) return null;
    const u = new URL(path, 'http://spendly.local');
    const st = u.searchParams.get('status');
    if (st) return list.filter((p) => p.status === st);
    return list;
  }
  return null;
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  if (method !== 'GET') {
    return rawRequest(path, options);
  }

  if (!browserOnline()) {
    const hit = await readGetCaches(path);
    if (hit != null) return hit;
    throw new Error('Offline — open Spendly online once on this device to save a copy, then try again.');
  }

  try {
    const data = await rawRequest(path, options);
    await writeGetCaches(path, data);
    return data;
  } catch (e) {
    if (e.status === 401) throw e;
    if (isOfflineFetchError(e)) {
      const hit = await readGetCaches(path);
      if (hit != null) return hit;
    }
    throw e;
  }
}

async function refreshAccountsFromServer() {
  try {
    const data = await rawRequest('/api/accounts');
    await cachePut('accounts', data);
  } catch {
    /* ignore */
  }
}

async function postTransactionWithOffline(body) {
  const clientEntityId = `local_${crypto.randomUUID()}`;
  const accounts = await cacheGet('accounts');

  if (browserOnline()) {
    try {
      const data = await rawRequest('/api/transactions', { method: 'POST', body: JSON.stringify(body) });
      await invalidateBundlesForMonth(monthStrFromTxDate(data.date));
      await refreshAccountsFromServer();
      return data;
    } catch (e) {
      if (e.status === 401) throw e;
      if (!isOfflineFetchError(e)) throw e;
    }
  }

  const tx = buildLocalTransaction(body, clientEntityId, accounts);
  await outboxAdd({ method: 'POST', path: '/api/transactions', body, clientEntityId });
  await applyCreateTransactionToCaches(tx, body);
  return tx;
}

function mergeTxPatch(existing, body) {
  const merged = { ...existing };
  if (body.amount != null) merged.amount = Number(body.amount);
  if (body.category != null) merged.category = String(body.category);
  if (body.note != null) merged.note = String(body.note);
  if (body.date != null) merged.date = new Date(body.date).toISOString();
  if (body.accountId != null) merged.accountId = body.accountId;
  if (body.fromAccountId != null) merged.fromAccountId = body.fromAccountId;
  if (body.toAccountId != null) merged.toAccountId = body.toAccountId;
  if (body.newBalance != null) merged.balanceAfterTransaction = Number(body.newBalance);
  return merged;
}

export const api = {
  register: (body) => {
    if (!browserOnline()) throw new Error('You need an internet connection to register.');
    return rawRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },
  login: (body) => {
    if (!browserOnline()) throw new Error('You need an internet connection to log in.');
    return rawRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },
  me: () => rawRequest('/api/auth/me'),
  updateEmailPreferences: (body) =>
    rawRequest('/api/auth/email-preferences', { method: 'PATCH', body: JSON.stringify(body) }),
  updateBudget: (budget) => rawRequest('/api/auth/budget', { method: 'PATCH', body: JSON.stringify({ budget }) }),
  accounts: () => request('/api/accounts'),
  createAccount: async (body) => {
    if (browserOnline()) {
      try {
        const data = await rawRequest('/api/accounts', { method: 'POST', body: JSON.stringify(body) });
        await refreshAccountsFromServer();
        return data;
      } catch (e) {
        if (e.status === 401) throw e;
        if (!isOfflineFetchError(e)) throw e;
      }
    }
    await outboxAdd({ method: 'POST', path: '/api/accounts', body });
    const accs = (await cacheGet('accounts')) || [];
    const optimistic = {
      _id: `local_${crypto.randomUUID()}`,
      name: body.name,
      balance: 0,
      pendingSync: true,
    };
    const next = Array.isArray(accs) ? [...accs, optimistic] : [optimistic];
    await cachePut('accounts', next);
    return optimistic;
  },
  updateAccount: async (id, body) => {
    if (!browserOnline()) throw new Error('Rename accounts when you are back online.');
    return rawRequest(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  deleteAccount: async (id) => {
    if (!browserOnline()) throw new Error('Delete accounts when you are back online.');
    return rawRequest(`/api/accounts/${id}`, { method: 'DELETE' });
  },
  notes: () => {
    if (!browserOnline()) return Promise.resolve([]);
    return rawRequest('/api/transactions/notes');
  },
  searchTransactions: (params) => {
    if (!browserOnline()) throw new Error('Connect to the internet to search your full history.');
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v);
    }
    return request(`/api/transactions/search?${q}`);
  },
  transactions: (month, accountId) => {
    const q = new URLSearchParams({ month });
    if (accountId) q.set('accountId', accountId);
    return request(`/api/transactions?${q}`);
  },
  createTransaction: (body) => postTransactionWithOffline(body),
  patchTransaction: async (id, body) => {
    const existing = await findTransactionInCaches(id);
    if (browserOnline()) {
      try {
        const data = await rawRequest(`/api/transactions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        if (existing) {
          await invalidateBundlesForMonth(monthStrFromTxDate(existing.date));
          await invalidateBundlesForMonth(monthStrFromTxDate(data.date));
        } else {
          await cacheInvalidateBundles();
        }
        await refreshAccountsFromServer();
        return data;
      } catch (e) {
        if (e.status === 401) throw e;
        if (!isOfflineFetchError(e)) throw e;
      }
    }
    if (!existing) throw new Error('Transaction not found in offline copy.');
    const merged = mergeTxPatch(existing, body);
    await outboxAdd({ method: 'PATCH', path: `/api/transactions/${id}`, body });
    await applyPatchTransactionToCaches(existing, merged);
    return merged;
  },
  deleteTransaction: async (id) => {
    const existing = await findTransactionInCaches(id);
    if (browserOnline()) {
      try {
        await rawRequest(`/api/transactions/${id}`, { method: 'DELETE' });
        if (existing) await invalidateBundlesForMonth(monthStrFromTxDate(existing.date));
        else await cacheInvalidateBundles();
        await refreshAccountsFromServer();
        return { ok: true };
      } catch (e) {
        if (e.status === 401) throw e;
        if (!isOfflineFetchError(e)) throw e;
      }
    }
    await outboxAdd({ method: 'DELETE', path: `/api/transactions/${id}` });
    if (existing) await applyDeleteTransactionToCaches(existing);
    return { ok: true };
  },
  updateAccountBalance: (args) =>
    postTransactionWithOffline({
      type: 'balance_update',
      accountId: args.accountId,
      newBalance: Number(args.newBalance),
      date: args.date || new Date().toISOString(),
      note: args.note || '',
    }),
  pending: (status) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request(`/api/pending${q}`);
  },
  createPending: async (body) => {
    const clientEntityId = `local_${crypto.randomUUID()}`;
    if (browserOnline()) {
      try {
        const data = await rawRequest('/api/pending', { method: 'POST', body: JSON.stringify(body) });
        const list = await cacheGet('pending:list');
        const arr = Array.isArray(list) ? [data, ...list.filter((p) => String(p._id) !== String(data._id))] : [data];
        await cachePut('pending:list', arr);
        return data;
      } catch (e) {
        if (e.status === 401) throw e;
        if (!isOfflineFetchError(e)) throw e;
      }
    }
    const doc = {
      _id: clientEntityId,
      personName: body.personName,
      amount: Number(body.amount),
      category: body.category,
      date: body.date,
      note: body.note || '',
      status: 'pending',
      pendingSync: true,
    };
    await outboxAdd({ method: 'POST', path: '/api/pending', body, clientEntityId });
    const list = await cacheGet('pending:list');
    const arr = Array.isArray(list) ? [doc, ...list] : [doc];
    await cachePut('pending:list', arr);
    return doc;
  },
  settlePending: async (id, accountId) => {
    if (!browserOnline()) {
      throw new Error('Connect to the internet to settle a debt (the server posts the income).');
    }
    const data = await rawRequest(`/api/pending/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ accountId }),
    });
    const list = await cacheGet('pending:list');
    if (Array.isArray(list) && data?.pending) {
      await cachePut(
        'pending:list',
        list.map((p) => (String(p._id) === String(data.pending._id) ? data.pending : p))
      );
    }
    if (data?.transaction?.date) await invalidateBundlesForMonth(monthStrFromTxDate(data.transaction.date));
    await refreshAccountsFromServer();
    return data;
  },
  settlePartialPending: async (id, accountId, amount) => {
    if (!browserOnline()) {
      throw new Error('Connect to the internet to settle a debt (the server posts the income).');
    }
    const data = await rawRequest(`/api/pending/${id}/settle-partial`, {
      method: 'POST',
      body: JSON.stringify({ accountId, amount: Number(amount) }),
    });
    const list = await cacheGet('pending:list');
    if (Array.isArray(list) && data?.pending) {
      await cachePut(
        'pending:list',
        list.map((p) => (String(p._id) === String(data.pending._id) ? data.pending : p))
      );
    }
    if (data?.transaction?.date) await invalidateBundlesForMonth(monthStrFromTxDate(data.transaction.date));
    await refreshAccountsFromServer();
    return data;
  },
  patchPending: async (id, body) => {
    if (browserOnline()) {
      try {
        const data = await rawRequest(`/api/pending/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
        const list = await cacheGet('pending:list');
        if (Array.isArray(list)) {
          await cachePut(
            'pending:list',
            list.map((p) => (String(p._id) === String(id) ? data : p))
          );
        }
        return data;
      } catch (e) {
        if (e.status === 401) throw e;
        if (!isOfflineFetchError(e)) throw e;
      }
    }
    const list = await cacheGet('pending:list');
    if (!Array.isArray(list)) throw new Error('No offline copy of pending debts.');
    const idx = list.findIndex((p) => String(p._id) === String(id));
    if (idx === -1) throw new Error('Pending item not found offline.');
    const merged = { ...list[idx], ...body, pendingSync: true };
    list[idx] = merged;
    await cachePut('pending:list', list);
    await outboxAdd({ method: 'PATCH', path: `/api/pending/${id}`, body });
    return merged;
  },
  deletePending: async (id) => {
    if (browserOnline()) {
      try {
        await rawRequest(`/api/pending/${id}`, { method: 'DELETE' });
        const list = await cacheGet('pending:list');
        if (Array.isArray(list)) {
          await cachePut(
            'pending:list',
            list.filter((p) => String(p._id) !== String(id))
          );
        }
        return { ok: true };
      } catch (e) {
        if (e.status === 401) throw e;
        if (!isOfflineFetchError(e)) throw e;
      }
    }
    const list = await cacheGet('pending:list');
    if (Array.isArray(list)) {
      await cachePut(
        'pending:list',
        list.filter((p) => String(p._id) !== String(id))
      );
    }
    await outboxAdd({ method: 'DELETE', path: `/api/pending/${id}` });
    return { ok: true };
  },
  categories: () => request('/api/categories'),
  addCategory: async (name) => {
    if (!browserOnline()) throw new Error('Add categories when you are back online.');
    return rawRequest('/api/categories', { method: 'POST', body: JSON.stringify({ name }) });
  },
  deleteCategory: async (name) => {
    if (!browserOnline()) throw new Error('Delete categories when you are back online.');
    return rawRequest(`/api/categories/${encodeURIComponent(name)}`, { method: 'DELETE' });
  },
  statsSummary: async (from, to) => {
    if (!browserOnline()) {
      throw new Error('Statistics need an internet connection.');
    }
    return rawRequest(`/api/stats/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  },
  statsTimeseries: async (from, to, bucket) => {
    if (!browserOnline()) {
      throw new Error('Statistics need an internet connection.');
    }
    return rawRequest(
      `/api/stats/timeseries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bucket=${bucket}`
    );
  },
};
