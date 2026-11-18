import { parseMonth } from '../utils/monthRange.js';

export function netWorthDelta(tx) {
  if (tx.type === 'income') return Number(tx.amount) || 0;
  if (tx.type === 'expense') return -(Number(tx.amount) || 0);
  if (tx.type === 'balance_update') return Number(tx.amount) || 0;
  return 0;
}

export function accountDelta(tx, accountIdStr) {
  const id = accountIdStr;
  if (tx.type === 'income' && String(tx.accountId) === id) return Number(tx.amount) || 0;
  if (tx.type === 'expense' && String(tx.accountId) === id) return -(Number(tx.amount) || 0);
  if (tx.type === 'transfer') {
    if (String(tx.fromAccountId) === id) return -(Number(tx.amount) || 0);
    if (String(tx.toAccountId) === id) return Number(tx.amount) || 0;
  }
  if (tx.type === 'balance_update' && String(tx.accountId) === id) return Number(tx.amount) || 0;
  return 0;
}

export function primaryAccountIdForRow(tx) {
  if (tx.type === 'transfer') return tx.fromAccountId ? String(tx.fromAccountId) : null;
  return tx.accountId ? String(tx.accountId) : null;
}

/** Server rule: opening uses all txs with date >= first day of viewed month. */
export function txAffectsOpeningFromMonthStart(tx, monthStr) {
  const range = parseMonth(monthStr);
  if (!range) return false;
  return new Date(tx.date).getTime() >= range.start.getTime();
}

export function txInBundleMonth(tx, monthStr) {
  const range = parseMonth(monthStr);
  if (!range) return false;
  const t = new Date(tx.date).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

/** Recompute running lines; filtered bundles get per-account running in both fields. */
export function enrichBundle(bundle) {
  const filterAcc = bundle.accountId || null;
  const list = [...(bundle.transactions || [])];
  const asc = [...list].sort((a, b) => {
    const d = new Date(a.date) - new Date(b.date);
    if (d !== 0) return d;
    return String(a._id).localeCompare(String(b._id));
  });

  let running = Number(bundle.openingBalance) || 0;
  const runningById = {};
  for (const tx of asc) {
    if (filterAcc) running += accountDelta(tx, filterAcc);
    else running += netWorthDelta(tx);
    runningById[String(tx._id)] = running;
  }

  bundle.transactions = list
    .sort((a, b) => {
      const d = new Date(b.date) - new Date(a.date);
      if (d !== 0) return d;
      return String(b._id).localeCompare(String(a._id));
    })
    .map((tx) => {
      const rb = runningById[String(tx._id)];
      const accRb = filterAcc ? rb : tx.pendingSync ? null : tx.accountRunningBalance;
      const rba = filterAcc || tx.pendingSync ? primaryAccountIdForRow(tx) : tx.runningBalanceAccountId;
      return {
        ...tx,
        runningBalance: rb,
        accountRunningBalance: accRb ?? null,
        runningBalanceAccountId: rba,
      };
    });

  return bundle;
}
