import { Router } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import { authRequired } from '../middleware/auth.js';
import { parseMonth } from '../utils/monthRange.js';
import {
  netWorthDelta,
  accountDelta,
  primaryAccountIdForRow,
  applyTxToRunners,
} from '../utils/balanceMath.js';
import {
  recalculateAllBalances,
  NegativeBalanceError,
  negativeBalanceMessage,
} from '../services/recalculateBalances.js';

const router = Router();
router.use(authRequired);

async function createWithReplay(userId, data) {
  const tx = await Transaction.create({ ...data, userId });
  try {
    await recalculateAllBalances(userId);
  } catch (e) {
    await Transaction.deleteOne({ _id: tx._id });
    if (e instanceof NegativeBalanceError) {
      const err = new Error(negativeBalanceMessage(e));
      err.statusCode = 400;
      throw err;
    }
    throw e;
  }
  return tx;
}

router.get('/', async (req, res) => {
  try {
    const { month, accountId } = req.query;
    const range = parseMonth(month);
    if (!range) {
      return res.status(400).json({ message: 'Query "month" must be YYYY-MM' });
    }
    const { start, end } = range;
    const userId = new mongoose.Types.ObjectId(req.userId);

    const accounts = await Account.find({ userId: req.userId }).lean();
    const accountMap = Object.fromEntries(accounts.map((a) => [a._id.toString(), a]));

    const futureFilter = { userId, date: { $gte: start } };
    const futureTxs = await Transaction.find(futureFilter).sort({ date: 1, _id: 1 }).lean();

    let opening;
    if (accountId) {
      const acc = accountMap[accountId];
      if (!acc) return res.status(404).json({ message: 'Account not found' });
      const cur = acc.type === 'credit' ? (acc.billedAmount + acc.unbilledAmount) : acc.balance;
      const effect = futureTxs.reduce((s, tx) => s + accountDelta(tx, accountId), 0);
      opening = cur - effect;
    } else {
      const cur = accounts.reduce((s, a) => s + (a.type === 'credit' ? -(a.billedAmount + a.unbilledAmount) : a.balance), 0);
      const effect = futureTxs.reduce((s, tx) => s + netWorthDelta(tx), 0);
      opening = cur - effect;
    }

    const filter = {
      userId,
      date: { $gte: start, $lt: end },
    };
    if (accountId) {
      filter.$or = [
        { accountId },
        { fromAccountId: accountId },
        { toAccountId: accountId },
      ];
    }

    const monthTxs = await Transaction.find(filter)
      .sort({ date: -1, _id: -1 })
      .lean();

    const asc = [...monthTxs].sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date);
      if (d !== 0) return d;
      return String(a._id).localeCompare(String(b._id));
    });

    let running = opening;
    const withRunning = asc.map((tx) => {
      if (accountId) {
        running += accountDelta(tx, accountId);
      } else {
        running += netWorthDelta(tx);
      }
      return { ...tx, runningBalance: running };
    });
    const runningById = Object.fromEntries(withRunning.map((t) => [t._id.toString(), t.runningBalance]));

    const accountOpenings = {};
    for (const a of accounts) {
      const id = a._id.toString();
      const cur = a.type === 'credit' ? (a.billedAmount + a.unbilledAmount) : a.balance;
      const effect = futureTxs.reduce((s, tx) => s + accountDelta(tx, id), 0);
      accountOpenings[id] = cur - effect;
    }

    const runners = {};
    for (const a of accounts) {
      runners[a._id.toString()] = accountOpenings[a._id.toString()] ?? 0;
    }

    const accountRunningById = {};
    for (const tx of asc) {
      applyTxToRunners(runners, tx);
      const pid = primaryAccountIdForRow(tx);
      accountRunningById[tx._id.toString()] = pid != null ? runners[pid] : null;
    }

    const enriched = monthTxs.map((tx) => ({
      ...tx,
      runningBalance: runningById[tx._id.toString()],
      accountRunningBalance: accountRunningById[tx._id.toString()],
      runningBalanceAccountId: primaryAccountIdForRow(tx),
    }));

    res.json({
      month: month,
      accountId: accountId || null,
      openingBalance: opening,
      transactions: enriched,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load transactions' });
  }
});

router.get('/notes', async (req, res) => {
  try {
    const notes = await Transaction.distinct('note', { 
      userId: req.userId, 
      note: { $nin: ['', null] } 
    });
    res.json(notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load notes' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, start, end, min, max, accountId } = req.query;
    const filter = { userId: req.userId };

    if (q) {
      const regex = new RegExp(q, 'i');
      filter.$or = [
        { note: regex },
        { category: regex }
      ];
    }

    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = new Date(start);
      if (end) filter.date.$lte = new Date(end);
    }

    if (min !== undefined && min !== '') {
      filter.amount = filter.amount || {};
      filter.amount.$gte = Number(min);
    }
    if (max !== undefined && max !== '') {
      filter.amount = filter.amount || {};
      filter.amount.$lte = Number(max);
    }

    if (accountId) {
      const idFilter = [
        { accountId },
        { fromAccountId: accountId },
        { toAccountId: accountId }
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: idFilter }];
        delete filter.$or;
      } else {
        filter.$or = idFilter;
      }
    }

    const txs = await Transaction.find(filter).sort({ date: -1, _id: -1 }).limit(100).lean();
    res.json(txs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to search transactions' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { type } = req.body;
    const note = typeof req.body.note === 'string' ? req.body.note : '';

    if (type === 'balance_update') {
      const accountId = req.body.accountId;
      const newBal = Number(req.body.newBalance);
      const d = new Date(req.body.date || Date.now());
      if (!accountId || Number.isNaN(newBal) || Number.isNaN(d.getTime())) {
        return res.status(400).json({ message: 'accountId, newBalance, and valid date are required' });
      }
      await recalculateAllBalances(req.userId);
      const account = await Account.findOne({ _id: accountId, userId: req.userId });
      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }
      if (account.balance === newBal) {
        return res.status(400).json({ message: 'New balance is the same as the current balance' });
      }
      const tx = await createWithReplay(req.userId, {
        type: 'balance_update',
        amount: 0,
        category: 'Balance update',
        accountId: account._id,
        accountName: account.name,
        accountType: account.type,
        date: d,
        note: note.trim(),
        balanceAfterTransaction: newBal,
        balanceAccountId: account._id,
      });
      return res.status(201).json(tx);
    }

    const { amount, category, date } = req.body;
    const numAmount = Number(amount);
    if (!type || !category || !date || Number.isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ message: 'Invalid transaction payload' });
    }

    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }

    if (type === 'income' || type === 'expense' || type === 'credit_expense') {
      const accountId = req.body.accountId;
      if (!accountId) {
        return res.status(400).json({ message: 'accountId is required' });
      }
      const account = await Account.findOne({ _id: accountId, userId: req.userId });
      if (!account) {
        return res.status(404).json({ message: 'Account not found' });
      }
      if (type === 'credit_expense' && account.type !== 'credit') {
        return res.status(400).json({ message: 'Must select a credit account for a credit expense' });
      }
      const tx = await createWithReplay(req.userId, {
        type,
        amount: numAmount,
        category,
        accountId: account._id,
        accountName: account.name,
        accountType: account.type,
        date: d,
        note,
        balanceAfterTransaction: 0,
        balanceAccountId: account._id,
      });
      return res.status(201).json(tx);
    }

    if (type === 'transfer' || type === 'credit_payment') {
      const { fromAccountId, toAccountId } = req.body;
      if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
        return res.status(400).json({ message: 'Valid from and to accounts are required' });
      }
      const from = await Account.findOne({ _id: fromAccountId, userId: req.userId });
      const to = await Account.findOne({ _id: toAccountId, userId: req.userId });
      if (!from || !to) {
        return res.status(404).json({ message: 'Account not found' });
      }
      if (type === 'credit_payment' && to.type !== 'credit') {
        return res.status(400).json({ message: 'Destination account must be a credit account' });
      }
      const tx = await createWithReplay(req.userId, {
        type,
        amount: numAmount,
        category: category || (type === 'transfer' ? 'Transfer' : 'Credit Payment'),
        fromAccountId: from._id,
        fromAccountName: from.name,
        fromAccountType: from.type,
        toAccountId: to._id,
        toAccountName: to.name,
        toAccountType: to.type,
        date: d,
        note,
        balanceAfterTransaction: 0,
        toBalanceAfterTransaction: 0,
        balanceAccountId: from._id,
      });
      return res.status(201).json(tx);
    }

    return res.status(400).json({ message: 'Invalid transaction type' });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    res.status(500).json({ message: 'Failed to create transaction' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!tx) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const backup = tx.toObject();

    if (tx.type === 'income' || tx.type === 'expense' || tx.type === 'credit_expense') {
      if (req.body.amount != null) tx.amount = Number(req.body.amount);
      if (req.body.category != null) tx.category = String(req.body.category).trim();
      if (req.body.note != null) tx.note = String(req.body.note);
      if (req.body.date != null) tx.date = new Date(req.body.date);
      if (req.body.accountId != null) {
        const acc = await Account.findOne({ _id: req.body.accountId, userId: req.userId });
        if (acc) {
          tx.accountId = acc._id;
          tx.accountName = acc.name;
          tx.accountType = acc.type;
          tx.balanceAccountId = acc._id;
        }
      }
    } else if (tx.type === 'transfer' || tx.type === 'credit_payment') {
      if (req.body.amount != null) tx.amount = Number(req.body.amount);
      if (req.body.category != null) tx.category = String(req.body.category).trim();
      if (req.body.note != null) tx.note = String(req.body.note);
      if (req.body.date != null) tx.date = new Date(req.body.date);
      if (req.body.fromAccountId != null) {
        const acc = await Account.findOne({ _id: req.body.fromAccountId, userId: req.userId });
        if (acc) {
          tx.fromAccountId = acc._id;
          tx.fromAccountName = acc.name;
          tx.fromAccountType = acc.type;
          tx.balanceAccountId = acc._id;
        }
      }
      if (req.body.toAccountId != null) {
        const acc = await Account.findOne({ _id: req.body.toAccountId, userId: req.userId });
        if (acc) {
          tx.toAccountId = acc._id;
          tx.toAccountName = acc.name;
          tx.toAccountType = acc.type;
        }
      }
    } else if (tx.type === 'balance_update') {
      if (req.body.newBalance != null) tx.balanceAfterTransaction = Number(req.body.newBalance);
      if (req.body.note != null) tx.note = String(req.body.note);
      if (req.body.date != null) tx.date = new Date(req.body.date);
      if (req.body.accountId != null) {
        const acc = await Account.findOne({ _id: req.body.accountId, userId: req.userId });
        if (acc) {
          tx.accountId = acc._id;
          tx.accountName = acc.name;
          tx.accountType = acc.type;
          tx.balanceAccountId = acc._id;
        }
      }
    }

    if ((tx.type === 'transfer' || tx.type === 'credit_payment') && tx.fromAccountId?.toString() === tx.toAccountId?.toString()) {
      return res.status(400).json({ message: 'From and to accounts must differ' });
    }

    if (tx.type !== 'balance_update') {
      if (Number.isNaN(tx.amount) || tx.amount < 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
    } else if (Number.isNaN(tx.balanceAfterTransaction)) {
      return res.status(400).json({ message: 'Invalid balance' });
    }

    if (Number.isNaN(tx.date.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }

    await tx.save();

    try {
      await recalculateAllBalances(req.userId);
    } catch (e) {
      await Transaction.findOneAndReplace({ _id: backup._id }, backup, { runValidators: false });
      if (e instanceof NegativeBalanceError) {
        return res.status(400).json({ message: negativeBalanceMessage(e) });
      }
      throw e;
    }

    const fresh = await Transaction.findById(tx._id);
    res.json(fresh);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update transaction' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!tx) {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    const snapshot = tx.toObject();
    await Transaction.deleteOne({ _id: tx._id });
    try {
      await recalculateAllBalances(req.userId);
    } catch (e) {
      await Transaction.create(snapshot);
      if (e instanceof NegativeBalanceError) {
        return res.status(400).json({
          message: 'Deleting this transaction would make an account negative; edit or delete other rows first.',
        });
      }
      throw e;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete transaction' });
  }
});

export default router;
