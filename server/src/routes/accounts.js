import { Router } from 'express';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.userId }).sort({ createdAt: 1 }).lean();
    res.json(accounts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load accounts' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, type = 'custom', creditLimit, billingDate, dueDate } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Account name is required' });
    }
    const validatedType = ['cash', 'online', 'card', 'credit', 'custom'].includes(type) ? type : 'custom';
    const accountData = {
      userId: req.userId,
      name: name.trim(),
      type: validatedType,
      balance: 0,
    };
    if (validatedType === 'credit') {
      accountData.creditLimit = Number(creditLimit) || 0;
      accountData.billingDate = Number(billingDate) || 1;
      accountData.dueDate = Number(dueDate) || 15;
    }
    const account = await Account.create(accountData);
    res.status(201).json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create account' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name, creditLimit, billingDate, dueDate } = req.body;
    const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
    if (!account) return res.status(404).json({ message: 'Account not found' });
    if (name?.trim()) account.name = name.trim();
    if (account.type === 'credit') {
      if (creditLimit !== undefined) account.creditLimit = Number(creditLimit) || 0;
      if (billingDate !== undefined) account.billingDate = Number(billingDate) || 1;
      if (dueDate !== undefined) account.dueDate = Number(dueDate) || 15;
    }
    await account.save();
    res.json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update account' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }
    if (account.balance !== 0 || account.billedAmount !== 0 || account.unbilledAmount !== 0) {
      return res.status(400).json({ message: 'Only accounts with zero balances/dues can be deleted' });
    }
    const inUse = await Transaction.exists({
      userId: req.userId,
      $or: [{ accountId: account._id }, { fromAccountId: account._id }, { toAccountId: account._id }],
    });
    if (inUse) {
      return res.status(400).json({ message: 'Cannot delete account with transaction history' });
    }
    await Account.deleteOne({ _id: account._id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

export default router;
