import mongoose from 'mongoose';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';

function advanceBilling(acc, txDate) {
  if (acc.type !== 'credit' || !acc.billingDate) return;
  const d = new Date(txDate);
  if (!acc.lastBilledDate) {
    const start = new Date(d);
    start.setDate(Math.min(acc.billingDate, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
    if (start > d) {
      start.setMonth(start.getMonth() - 1);
      start.setDate(Math.min(acc.billingDate, new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()));
    }
    start.setHours(0, 0, 0, 0);
    acc.lastBilledDate = start;
  }
  
  while (true) {
    const next = new Date(acc.lastBilledDate);
    next.setMonth(next.getMonth() + 1);
    next.setDate(Math.min(acc.billingDate, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    if (d >= next) {
      acc.billedAmount += acc.unbilledAmount;
      acc.unbilledAmount = 0;
      acc.lastBilledDate = next;
    } else {
      break;
    }
  }
}


export class NegativeBalanceError extends Error {
  constructor(accountName, balance) {
    super('ACCOUNT_NEGATIVE');
    this.accountName = accountName;
    this.balance = balance;
  }
}

/**
 * Replay all transactions in order, update account balances, and sync balance_update deltas.
 */
export async function recalculateAllBalances(userId) {
  const uid = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  const accounts = await Account.find({ userId: uid });
  for (const a of accounts) {
    a.balance = 0;
    if (a.type === 'credit') {
      a.billedAmount = 0;
      a.unbilledAmount = 0;
      a.lastBilledDate = null;
    }
  }
  const byId = Object.fromEntries(accounts.map((a) => [a._id.toString(), a]));
  const txs = await Transaction.find({ userId: uid }).sort({ date: 1, _id: 1 });

  const txSaves = [];

  for (const doc of txs) {
    if (doc.type === 'income') {
      const acc = byId[doc.accountId?.toString()];
      if (acc) acc.balance += doc.amount;
    } else if (doc.type === 'expense') {
      const acc = byId[doc.accountId?.toString()];
      if (acc) acc.balance -= doc.amount;
    } else if (doc.type === 'transfer') {
      const from = byId[doc.fromAccountId?.toString()];
      const to = byId[doc.toAccountId?.toString()];
      if (from) from.balance -= doc.amount;
      if (to) to.balance += doc.amount;
    } else if (doc.type === 'balance_update') {
      const acc = byId[doc.accountId?.toString()];
      if (acc && doc.balanceAfterTransaction != null && !Number.isNaN(Number(doc.balanceAfterTransaction))) {
        const target = Number(doc.balanceAfterTransaction);
        const before = acc.balance;
        const delta = target - before;
        if (doc.amount !== delta) {
          doc.amount = delta;
          txSaves.push(doc.save());
        }
        acc.balance = target;
      }
    } else if (doc.type === 'credit_expense') {
      const acc = byId[doc.accountId?.toString()];
      if (acc && acc.type === 'credit') {
        advanceBilling(acc, doc.date);
        acc.unbilledAmount += doc.amount;
      }
    } else if (doc.type === 'credit_payment') {
      const from = byId[doc.fromAccountId?.toString()];
      const to = byId[doc.toAccountId?.toString()];
      if (from) from.balance -= doc.amount;
      if (to && to.type === 'credit') {
        advanceBilling(to, doc.date);
        if (doc.amount <= to.billedAmount) {
          to.billedAmount -= doc.amount;
        } else {
          const rem = doc.amount - to.billedAmount;
          to.billedAmount = 0;
          to.unbilledAmount -= rem;
        }
      }
    }
  }

  // Final advance to current date to show accurate billed amount today
  const now = new Date();
  for (const a of accounts) {
    if (a.type === 'credit') {
      advanceBilling(a, now);
    }
  }

  for (const a of accounts) {
    if (a.balance < -1e-6) {
      throw new NegativeBalanceError(a.name, a.balance);
    }
  }

  await Promise.all([...accounts.map((a) => a.save()), ...txSaves]);
}

export function negativeBalanceMessage(err) {
  if (err instanceof NegativeBalanceError) {
    return `This would make "${err.accountName}" negative (${err.balance.toFixed(2)}). Adjust amounts or accounts.`;
  }
  return err.message || 'Balance error';
}
