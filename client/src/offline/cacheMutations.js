import {
  accountDelta,
  enrichBundle,
  netWorthDelta,
  txAffectsOpeningFromMonthStart,
  txInBundleMonth,
} from './bundleMath.js';
import { cacheDelete, cacheGet, cachePut, listBundleCacheKeys } from './store.js';

export function bundleCacheKey(month, accountId) {
  return `bundle:${month}:${accountId || ''}`;
}

/** @param {string} key */
export function parseBundleKey(key) {
  const m = /^bundle:([^:]+):(.*)$/.exec(key);
  if (!m) return null;
  return { month: m[1], accountId: m[2] || null };
}

function applyOpeningForCreate(bundle, tx, monthStr, filterAcc) {
  if (!txAffectsOpeningFromMonthStart(tx, monthStr)) return;
  const d = filterAcc ? accountDelta(tx, filterAcc) : netWorthDelta(tx);
  if (filterAcc && d === 0) return;
  bundle.openingBalance = (Number(bundle.openingBalance) || 0) - d;
}

function applyOpeningForDelete(bundle, tx, monthStr, filterAcc) {
  if (!txAffectsOpeningFromMonthStart(tx, monthStr)) return;
  const d = filterAcc ? accountDelta(tx, filterAcc) : netWorthDelta(tx);
  if (filterAcc && d === 0) return;
  bundle.openingBalance = (Number(bundle.openingBalance) || 0) + d;
}

/** @param {number} mult +1 create, -1 delete */
export function applyAccountsDelta(accounts, tx, mult) {
  if (!Array.isArray(accounts)) return;
  const byId = Object.fromEntries(accounts.map((a) => [String(a._id), a]));
  const bump = (id, delta) => {
    const a = byId[String(id)];
    if (a) a.balance = (Number(a.balance) || 0) + mult * delta;
  };
  if (tx.type === 'income') bump(tx.accountId, Number(tx.amount) || 0);
  else if (tx.type === 'expense') bump(tx.accountId, -(Number(tx.amount) || 0));
  else if (tx.type === 'transfer') {
    bump(tx.fromAccountId, -(Number(tx.amount) || 0));
    bump(tx.toAccountId, Number(tx.amount) || 0);
  } else if (tx.type === 'balance_update') {
    const a = byId[String(tx.accountId)];
    if (!a) return;
    if (mult === 1) a.balance = Number(tx.balanceAfterTransaction);
    else if (tx.balanceBeforeUpdate != null) a.balance = Number(tx.balanceBeforeUpdate);
  }
}

export function buildLocalTransaction(body, clientId, accounts) {
  const dateIso = new Date(body.date || Date.now()).toISOString();
  if (body.type === 'balance_update') {
    const acc = accounts?.find((a) => String(a._id) === String(body.accountId));
    const prev = acc ? Number(acc.balance) : 0;
    const nb = Number(body.newBalance);
    return {
      _id: clientId,
      type: 'balance_update',
      amount: Number.isNaN(nb - prev) ? 0 : nb - prev,
      category: 'Balance update',
      accountId: body.accountId,
      date: dateIso,
      note: typeof body.note === 'string' ? body.note : '',
      balanceAfterTransaction: nb,
      balanceAccountId: body.accountId,
      pendingSync: true,
      balanceBeforeUpdate: prev,
    };
  }
  if (body.type === 'transfer') {
    return {
      _id: clientId,
      type: 'transfer',
      amount: Number(body.amount),
      category: body.category || 'Transfer',
      fromAccountId: body.fromAccountId,
      toAccountId: body.toAccountId,
      date: dateIso,
      note: typeof body.note === 'string' ? body.note : '',
      balanceAfterTransaction: 0,
      balanceAccountId: body.fromAccountId,
      pendingSync: true,
    };
  }
  return {
    _id: clientId,
    type: body.type,
    amount: Number(body.amount),
    category: body.category || 'Other',
    accountId: body.accountId,
    date: dateIso,
    note: typeof body.note === 'string' ? body.note : '',
    balanceAfterTransaction: 0,
    balanceAccountId: body.accountId,
    pendingSync: true,
  };
}

export async function findTransactionInCaches(id) {
  const keys = await listBundleCacheKeys();
  for (const k of keys) {
    const bundle = await cacheGet(k);
    const t = (bundle?.transactions || []).find((x) => String(x._id) === String(id));
    if (t) return { ...t };
  }
  return null;
}

async function forEachBundle(fn) {
  const keys = await listBundleCacheKeys();
  for (const key of keys) {
    const bundle = await cacheGet(key);
    if (!bundle) continue;
    const parsed = parseBundleKey(key);
    if (!parsed) continue;
    await fn(key, bundle, parsed.month, parsed.accountId);
  }
}

export async function invalidateBundlesForMonth(monthStr) {
  const keys = await listBundleCacheKeys();
  for (const k of keys) {
    const p = parseBundleKey(k);
    if (p?.month === monthStr) await cacheDelete(k);
  }
}

export async function applyCreateTransactionToCaches(tx, body) {
  await forEachBundle(async (key, bundle, monthStr, filterAcc) => {
    applyOpeningForCreate(bundle, tx, monthStr, filterAcc);
    if (txInBundleMonth(tx, monthStr)) {
      const list = bundle.transactions || [];
      if (!list.some((t) => String(t._id) === String(tx._id))) {
        bundle.transactions = [tx, ...list];
      }
    }
    enrichBundle(bundle);
    await cachePut(key, bundle);
  });

  const accounts = await cacheGet('accounts');
  if (accounts) {
    applyAccountsDelta(accounts, tx, 1);
    await cachePut('accounts', accounts);
  }
}

export async function applyDeleteTransactionToCaches(tx) {
  await forEachBundle(async (key, bundle, monthStr, filterAcc) => {
    applyOpeningForDelete(bundle, tx, monthStr, filterAcc);
    bundle.transactions = (bundle.transactions || []).filter((t) => String(t._id) !== String(tx._id));
    enrichBundle(bundle);
    await cachePut(key, bundle);
  });

  const accounts = await cacheGet('accounts');
  if (accounts) {
    applyAccountsDelta(accounts, tx, -1);
    await cachePut('accounts', accounts);
  }
}

export async function applyPatchTransactionToCaches(oldTx, mergedTx) {
  await applyDeleteTransactionToCaches(oldTx);
  await applyCreateTransactionToCaches(mergedTx, {});
}

export async function replacePendingIdInCaches(clientId, serverTx) {
  await forEachBundle(async (key, bundle) => {
    const list = bundle.transactions || [];
    const idx = list.findIndex((t) => String(t._id) === String(clientId));
    if (idx === -1) return;
    const next = { ...serverTx, pendingSync: false };
    delete next.balanceBeforeUpdate;
    list[idx] = next;
    bundle.transactions = list;
    enrichBundle(bundle);
    await cachePut(key, bundle);
  });
}
