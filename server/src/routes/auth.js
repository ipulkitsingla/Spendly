import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Account from '../models/Account.js';
import { authRequired, JWT_SECRET } from '../middleware/auth.js';
import { triggerWelcomeEmail } from '../services/reminderScheduler.js';

const router = Router();

const DEFAULT_ACCOUNTS = [
  { name: 'Cash', type: 'cash' },
  { name: 'Online', type: 'online' },
  { name: 'Card', type: 'card' },
];

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });
    await Account.insertMany(
      DEFAULT_ACCOUNTS.map((a) => ({
        userId: user._id,
        name: a.name,
        type: a.type,
        balance: 0,
      }))
    );
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
    triggerWelcomeEmail({
      name: user.name,
      email: user.email,
      emailPreferences: user.emailPreferences,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Login failed' });
  }
});

router.get('/me', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load profile' });
  }
});

router.patch('/email-preferences', authRequired, async (req, res) => {
  try {
    const allowed = ['monthlyStatement', 'expenseReminder', 'pendingDebtReminder', 'welcomeSignup'];
    const payload = {};
    for (const key of allowed) {
      if (key in req.body) payload[`emailPreferences.${key}`] = Boolean(req.body[key]);
    }
    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: 'Provide at least one preference to update' });
    }
    const user = await User.findByIdAndUpdate(req.userId, { $set: payload }, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ emailPreferences: user.emailPreferences });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update email preferences' });
  }
});

export default router;
