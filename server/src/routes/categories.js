import { Router } from 'express';
import User from '../models/User.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('categories').lean();
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.categories || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load categories' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    const trimmed = name.trim();
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const exists = user.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      return res.status(409).json({ message: 'Category already exists' });
    }
    user.categories.push({ name: trimmed, isCustom: true });
    await user.save();
    res.status(201).json(user.categories[user.categories.length - 1]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add category' });
  }
});

router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const idx = user.categories.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());
    if (idx === -1) {
      return res.status(404).json({ message: 'Category not found' });
    }
    if (!user.categories[idx].isCustom) {
      return res.status(400).json({ message: 'Cannot delete built-in categories' });
    }
    user.categories.splice(idx, 1);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete category' });
  }
});

export default router;
