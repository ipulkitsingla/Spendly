const DB_NAME = 'spendly-offline';
const DB_VER = 2;
const CACHE = 'cache';
const OUTBOX = 'outbox';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE);
      if (ev.oldVersion < 2) {
        if (db.objectStoreNames.contains(OUTBOX)) db.deleteObjectStore(OUTBOX);
        db.createObjectStore(OUTBOX, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function cacheGet(key) {
  return new Promise((resolve, reject) => {
    openDb().then((db) => {
      const t = db.transaction(CACHE, 'readonly');
      const r = t.objectStore(CACHE).get(key);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    }, reject);
  });
}

export function cachePut(key, value) {
  return new Promise((resolve, reject) => {
    openDb().then((db) => {
      const tr = db.transaction(CACHE, 'readwrite');
      tr.objectStore(CACHE).put(value, key);
      tr.oncomplete = () => resolve();
      tr.onerror = () => reject(tr.error);
    }, reject);
  });
}

export function cacheDelete(key) {
  return new Promise((resolve, reject) => {
    openDb().then((db) => {
      const tr = db.transaction(CACHE, 'readwrite');
      tr.objectStore(CACHE).delete(key);
      tr.oncomplete = () => resolve();
      tr.onerror = () => reject(tr.error);
    }, reject);
  });
}

export function listBundleCacheKeys() {
  return new Promise((resolve, reject) => {
    openDb().then((db) => {
      const t = db.transaction(CACHE, 'readonly');
      const r = t.objectStore(CACHE).getAllKeys();
      r.onsuccess = () =>
        resolve((r.result || []).filter((k) => typeof k === 'string' && k.startsWith('bundle:')));
      r.onerror = () => reject(r.error);
    }, reject);
  });
}

/** @returns {Promise<number>} */
export function outboxAdd(entry) {
  return new Promise((resolve, reject) => {
    openDb().then((db) => {
      const tr = db.transaction(OUTBOX, 'readwrite');
      const rec = { createdAt: Date.now(), ...entry };
      const req = tr.objectStore(OUTBOX).add(rec);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }, reject);
  });
}

export function outboxGetAll() {
  return new Promise((resolve, reject) => {
    openDb().then((db) => {
      const t = db.transaction(OUTBOX, 'readonly');
      const r = t.objectStore(OUTBOX).getAll();
      r.onsuccess = () => {
        const rows = r.result || [];
        rows.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        resolve(rows);
      };
      r.onerror = () => reject(r.error);
    }, reject);
  });
}

export function outboxDelete(id) {
  return new Promise((resolve, reject) => {
    openDb().then((db) => {
      const tr = db.transaction(OUTBOX, 'readwrite');
      tr.objectStore(OUTBOX).delete(id);
      tr.oncomplete = () => resolve();
      tr.onerror = () => reject(tr.error);
    }, reject);
  });
}

export function outboxCount() {
  return new Promise((resolve, reject) => {
    openDb().then((db) => {
      const t = db.transaction(OUTBOX, 'readonly');
      const r = t.objectStore(OUTBOX).count();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }, reject);
  });
}

export async function cacheInvalidateBundles() {
  const keys = await listBundleCacheKeys();
  await Promise.all(keys.map((k) => cacheDelete(k)));
}
