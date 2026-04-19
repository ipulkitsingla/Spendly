import { rawRequest } from '../api/requestCore.js';
import {
  cacheGet,
  cacheInvalidateBundles,
  cachePut,
  outboxDelete,
  outboxGetAll,
} from './store.js';
import { replacePendingIdInCaches } from './cacheMutations.js';
import { browserOnline } from './networkState.js';

function resolvePath(path, idMap) {
  let p = path;
  for (const [loc, srv] of idMap.entries()) {
    p = p.split(loc).join(srv);
  }
  return p;
}

export async function refreshAccountsCache() {
  try {
    const data = await rawRequest('/api/accounts');
    await cachePut('accounts', data);
  } catch {
    /* ignore */
  }
}

async function replacePendingIdInPendingCache(clientId, serverDoc) {
  const list = await cacheGet('pending:list');
  if (!Array.isArray(list)) return;
  const idx = list.findIndex((p) => String(p._id) === String(clientId));
  if (idx === -1) return;
  list[idx] = { ...serverDoc };
  await cachePut('pending:list', list);
}

async function upsertPendingInCache(doc) {
  const raw = await cacheGet('pending:list');
  const arr = Array.isArray(raw) ? [...raw] : [];
  const idx = arr.findIndex((p) => String(p._id) === String(doc._id));
  if (idx >= 0) arr[idx] = doc;
  else arr.unshift(doc);
  await cachePut('pending:list', arr);
}

async function removePendingFromCacheByPath(path) {
  const m = /\/api\/pending\/([^/]+)/.exec(path);
  const id = m && m[1];
  if (!id) return;
  const list = await cacheGet('pending:list');
  if (!Array.isArray(list)) return;
  await cachePut(
    'pending:list',
    list.filter((p) => String(p._id) !== id)
  );
}

/**
 * Replay queued mutations (FIFO). Maps local_* ids to server ids between steps.
 */
export async function drainOutbox() {
  if (!browserOnline()) return { ok: true, remaining: (await outboxGetAll()).length };

  const idMap = new Map();

  for (;;) {
    const queue = await outboxGetAll();
    if (!queue.length) break;
    const item = queue[0];

    try {
      if (item.method === 'POST' && /\/api\/pending\/[^/]+\/settle/.test(String(item.path))) {
        const path = resolvePath(item.path, idMap);
        const data = await rawRequest(path, { method: 'POST', body: JSON.stringify(item.body || {}) });
        if (data?.pending) await upsertPendingInCache(data.pending);
        await outboxDelete(item.id);
        continue;
      }

      if (item.method === 'POST' && item.path === '/api/pending') {
        const data = await rawRequest(item.path, { method: 'POST', body: JSON.stringify(item.body) });
        if (item.clientEntityId) idMap.set(String(item.clientEntityId), String(data._id));
        await replacePendingIdInPendingCache(item.clientEntityId, data);
        await outboxDelete(item.id);
        continue;
      }

      if (item.method === 'POST' && item.path === '/api/transactions') {
        const data = await rawRequest(item.path, { method: 'POST', body: JSON.stringify(item.body) });
        if (item.clientEntityId) idMap.set(String(item.clientEntityId), String(data._id));
        await replacePendingIdInCaches(item.clientEntityId, data);
        await outboxDelete(item.id);
        continue;
      }

      if (item.method === 'PATCH' && String(item.path).startsWith('/api/transactions/')) {
        const path = resolvePath(item.path, idMap);
        await rawRequest(path, { method: 'PATCH', body: JSON.stringify(item.body) });
        await outboxDelete(item.id);
        continue;
      }

      if (item.method === 'DELETE' && String(item.path).startsWith('/api/transactions/')) {
        const path = resolvePath(item.path, idMap);
        await rawRequest(path, { method: 'DELETE' });
        await outboxDelete(item.id);
        continue;
      }

      if (item.method === 'PATCH' && String(item.path).startsWith('/api/pending/')) {
        const path = resolvePath(item.path, idMap);
        const data = await rawRequest(path, { method: 'PATCH', body: JSON.stringify(item.body) });
        await upsertPendingInCache(data);
        await outboxDelete(item.id);
        continue;
      }

      if (item.method === 'DELETE' && String(item.path).startsWith('/api/pending/')) {
        const path = resolvePath(item.path, idMap);
        await rawRequest(path, { method: 'DELETE' });
        await removePendingFromCacheByPath(path);
        await outboxDelete(item.id);
        continue;
      }

      if (item.method === 'POST' && item.path === '/api/accounts') {
        await rawRequest(item.path, { method: 'POST', body: JSON.stringify(item.body) });
        await outboxDelete(item.id);
        continue;
      }

      await outboxDelete(item.id);
    } catch (e) {
      if (e.status === 401) throw e;
      return { ok: false, error: e, remaining: queue.length };
    }
  }

  await refreshAccountsCache();
  await cacheInvalidateBundles();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spendly-sync-done'));
  }
  return { ok: true, remaining: 0 };
}
