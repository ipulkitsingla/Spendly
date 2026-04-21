import mongoose from 'mongoose';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import { netWorthDelta } from '../utils/balanceMath.js';
import { parseMonth } from '../utils/monthRange.js';

function monthLong(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
}

function txTitle(tx) {
  if (tx.type === 'transfer') return tx.note || tx.category || 'Transfer';
  if (tx.type === 'balance_update') return tx.note || 'Balance update';
  return tx.note || tx.category || 'Transaction';
}

function typeLabel(type) {
  if (type === 'balance_update') return 'Balance update';
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function shortDate(d) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(d)
  );
}

export async function buildMonthlyStatement(userId, monthKey) {
  const range = parseMonth(monthKey);
  if (!range) throw new Error('Invalid month key');
  const { start, end } = range;
  const uid = new mongoose.Types.ObjectId(userId);

  const accounts = await Account.find({ userId }).lean();
  const currentNetWorth = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);

  const futureTxs = await Transaction.find({ userId: uid, date: { $gte: start } })
    .sort({ date: 1, _id: 1 })
    .lean();
  const openingBalance = currentNetWorth - futureTxs.reduce((sum, tx) => sum + netWorthDelta(tx), 0);

  const monthTxs = await Transaction.find({ userId: uid, date: { $gte: start, $lt: end } })
    .sort({ date: 1, _id: 1 })
    .lean();

  let running = openingBalance;
  const rows = monthTxs.map((tx) => {
    running += netWorthDelta(tx);
    return {
      date: shortDate(tx.date),
      details: txTitle(tx),
      type: typeLabel(tx.type),
      amount: Number(tx.amount) || 0,
      runningBalance: running,
    };
  });

  const income = monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const expenses = monthTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const closingBalance = rows.length ? rows[rows.length - 1].runningBalance : openingBalance;

  return {
    monthKey,
    monthLabel: monthLong(monthKey),
    openingBalance,
    income,
    expenses,
    net: income - expenses,
    closingBalance,
    transactionCount: rows.length,
    rows,
  };
}
