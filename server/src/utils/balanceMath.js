/** Net-worth delta (all accounts) from a single transaction */
export function netWorthDelta(tx) {
  if (tx.type === 'income') return tx.amount;
  if (tx.type === 'expense') return -tx.amount;
  if (tx.type === 'balance_update') return tx.amount;
  return 0;
}

/** Balance delta for a specific account */
export function accountDelta(tx, accountIdStr) {
  const id = accountIdStr;
  if (tx.type === 'income' && tx.accountId?.toString() === id) return tx.amount;
  if (tx.type === 'expense' && tx.accountId?.toString() === id) return -tx.amount;
  if (tx.type === 'transfer') {
    if (tx.fromAccountId?.toString() === id) return -tx.amount;
    if (tx.toAccountId?.toString() === id) return tx.amount;
  }
  if (tx.type === 'balance_update' && tx.accountId?.toString() === id) return tx.amount;
  return 0;
}

/** Account whose running balance we show on the row (source account for transfers). */
export function primaryAccountIdForRow(tx) {
  if (tx.type === 'transfer') return tx.fromAccountId?.toString() || null;
  return tx.accountId?.toString() || null;
}

/** Mutates runners map (accountId string -> balance) by applying one transaction in chronological replay. */
export function applyTxToRunners(runners, tx) {
  if (tx.type === 'income') {
    const id = tx.accountId?.toString();
    if (id) runners[id] = (runners[id] ?? 0) + tx.amount;
  } else if (tx.type === 'expense') {
    const id = tx.accountId?.toString();
    if (id) runners[id] = (runners[id] ?? 0) - tx.amount;
  } else if (tx.type === 'transfer') {
    const f = tx.fromAccountId?.toString();
    const t = tx.toAccountId?.toString();
    if (f) runners[f] = (runners[f] ?? 0) - tx.amount;
    if (t) runners[t] = (runners[t] ?? 0) + tx.amount;
  } else if (tx.type === 'balance_update') {
    const id = tx.accountId?.toString();
    if (id != null && tx.balanceAfterTransaction != null && !Number.isNaN(Number(tx.balanceAfterTransaction))) {
      runners[id] = Number(tx.balanceAfterTransaction);
    }
  }
}
