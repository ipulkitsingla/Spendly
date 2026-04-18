import { Router } from 'express';
import PendingTransaction from '../models/PendingTransaction.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import { authRequired } from '../middleware/auth.js';
import { recalculateAllBalances, NegativeBalanceError, negativeBalanceMessage } from '../services/recalculateBalances.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const q = { userId: req.userId };
    if (status === 'pending' || status === 'settled') q.status = status;
    const items = await PendingTransaction.find(q).sort({ date: -1 }).lean();
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load pending transactions' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const doc = await PendingTransaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) {
      return res.status(404).json({ message: 'Pending transaction not found' });
    }
    if (doc.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending debts can be edited' });
    }
    const { personName, amount, category, date, note } = req.body;
    if (personName != null) {
      const n = String(personName).trim();
      if (!n) return res.status(400).json({ message: 'Person name is required' });
      doc.personName = n;
    }
    if (amount != null) {
      const num = Number(amount);
      if (Number.isNaN(num) || num < 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }
      doc.amount = num;
    }
    if (category != null) {
      const c = String(category).trim();
      if (!c) return res.status(400).json({ message: 'Category is required' });
      doc.category = c;
    }
    if (date != null) {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Invalid date' });
      }
      doc.date = d;
    }
    if (note != null) doc.note = String(note);
    await doc.save();
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update pending transaction' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await PendingTransaction.findOne({ _id: req.params.id, userId: req.userId });
    if (!doc) {
      return res.status(404).json({ message: 'Pending transaction not found' });
    }
    if (doc.status === 'settled') {
      return res.status(400).json({ message: 'Cannot delete a settled record' });
    }
    await PendingTransaction.deleteOne({ _id: doc._id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete pending transaction' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { personName, amount, category, date, note = '' } = req.body;
    const numAmount = Number(amount);
    if (!personName?.trim() || !category || !date || Number.isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ message: 'Invalid pending transaction' });
    }
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }
    const doc = await PendingTransaction.create({
      userId: req.userId,
      personName: personName.trim(),
      amount: numAmount,
      category,
      date: d,
      note,
      status: 'pending',
    });
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create pending transaction' });
  }
});

/** Settle: money you lent is repaid → record income to chosen account */
router.post('/:id/settle', async (req, res) => {
  try {
    const { accountId } = req.body;
    if (!accountId) {
      return res.status(400).json({ message: 'accountId is required to receive repayment' });
    }
    const pending = await PendingTransaction.findOne({
      _id: req.params.id,
      userId: req.userId,
      status: 'pending',
    });
    if (!pending) {
      return res.status(404).json({ message: 'Pending transaction not found or already settled' });
    }
    const account = await Account.findOne({ _id: accountId, userId: req.userId });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    const tx = await Transaction.create({
      userId: req.userId,
      type: 'income',
      amount: pending.amount,
      category: pending.category || 'Debt',
      accountId: account._id,
      date: new Date(),
      note: pending.note
        ? `Repayment from ${pending.personName}: ${pending.note}`
        : `Repayment from ${pending.personName}`,
      balanceAfterTransaction: 0,
      balanceAccountId: account._id,
    });
    try {
      await recalculateAllBalances(req.userId);
    } catch (e) {
      await Transaction.deleteOne({ _id: tx._id });
      if (e instanceof NegativeBalanceError) {
        return res.status(400).json({ message: negativeBalanceMessage(e) });
      }
      throw e;
    }
    pending.status = 'settled';
    pending.settledTransactionId = tx._id;
    await pending.save();
    res.json({ pending, transaction: tx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to settle pending transaction' });
  }
});

export default router;
