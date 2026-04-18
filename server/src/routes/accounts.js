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
    const { name, type = 'custom' } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Account name is required' });
    }
    const account = await Account.create({
      userId: req.userId,
      name: name.trim(),
      type: ['cash', 'online', 'card', 'custom'].includes(type) ? type : 'custom',
      balance: 0,
    });
    res.status(201).json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create account' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const account = await Account.findOne({ _id: req.params.id, userId: req.userId });
    if (!account) return res.status(404).json({ message: 'Account not found' });
    if (name?.trim()) account.name = name.trim();
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
    if (account.balance !== 0) {
      return res.status(400).json({ message: 'Only accounts with zero balance can be deleted' });
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
