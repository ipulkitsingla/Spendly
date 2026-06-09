import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Account from '../models/Account.js';
import { authRequired, JWT_SECRET } from '../middleware/auth.js';
import { triggerWelcomeEmail } from '../services/reminderScheduler.js';
import { sendEmail } from '../services/mailer.js';

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
    try {
      await triggerWelcomeEmail({
        name: user.name,
        email: user.email,
        emailPreferences: user.emailPreferences,
      });
    } catch {
      // Registration should still succeed even if email provider is down.
    }
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
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

router.patch('/budget', authRequired, async (req, res) => {
  try {
    const { budget } = req.body;
    const num = Number(budget);
    if (isNaN(num) || num < 0) {
      return res.status(400).json({ message: 'Budget must be a positive number' });
    }
    const user = await User.findByIdAndUpdate(req.userId, { $set: { monthlyBudget: num } }, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ monthlyBudget: user.monthlyBudget });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update budget' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log(`[AUTH] Forgot password requested for unregistered email: ${email}`);
      // Return 200 to prevent email enumeration
      return res.json({ message: 'If an account with that email exists, an OTP has been sent.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.resetOtpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    console.log(`[AUTH] Generated OTP ${otp} for ${user.email}`);

    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Spendly Password Reset OTP',
      text: `Your password reset code is: ${otp}\nThis code will expire in 15 minutes.`,
      html: `<h2>Password Reset</h2><p>Your 6-digit code is: <strong>${otp}</strong></p><p>This code will expire in 15 minutes.</p>`,
    });

    if (emailResult.skipped) {
      console.warn(`[AUTH] WARNING: Email was not sent because SMTP is not configured. The OTP is: ${otp}`);
    }

    res.json({ message: 'If an account with that email exists, an OTP has been sent.' });
  } catch (err) {
    console.error('[AUTH] Forgot Password Error:', err);
    res.status(500).json({ message: 'Failed to process request' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetOtp: otp,
      resetOtpExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Generate a temporary reset token (valid for 15 mins)
    const resetToken = jwt.sign({ resetUserId: user._id.toString() }, JWT_SECRET, { expiresIn: '15m' });
    
    // Clear OTP so it can't be reused
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();

    res.json({ resetToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    if (!decoded.resetUserId) {
      return res.status(400).json({ message: 'Invalid token payload' });
    }

    const user = await User.findById(decoded.resetUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

export default router;
