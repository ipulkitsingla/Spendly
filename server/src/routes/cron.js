import { Router } from 'express';
import { runExpenseReminder, runMonthlyStatementEmail, runPendingDebtReminder } from '../services/reminderScheduler.js';

const router = Router();

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const headerSecret = req.get('x-cron-secret') || req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const querySecret = String(req.query?.key || '');
  return headerSecret === secret || querySecret === secret;
}

function ensureCronAuth(req, res, next) {
  if (!cronAuthorized(req)) {
    return res.status(401).json({ message: 'Unauthorized cron trigger' });
  }
  next();
}

router.get('/health', (_, res) => {
  res.json({ ok: true });
});

router.post('/expense-reminder', ensureCronAuth, async (req, res) => {
  try {
    const stats = await runExpenseReminder();
    res.json({ ok: true, job: 'expense-reminder', stats });
  } catch (e) {
    res.status(500).json({ message: e?.message || 'expense reminder failed' });
  }
});

router.post('/pending-reminder', ensureCronAuth, async (req, res) => {
  try {
    const stats = await runPendingDebtReminder();
    res.json({ ok: true, job: 'pending-reminder', stats });
  } catch (e) {
    res.status(500).json({ message: e?.message || 'pending reminder failed' });
  }
});

router.post('/monthly-statement', ensureCronAuth, async (req, res) => {
  try {
    const stats = await runMonthlyStatementEmail();
    res.json({ ok: true, job: 'monthly-statement', stats });
  } catch (e) {
    res.status(500).json({ message: e?.message || 'monthly statement failed' });
  }
});

export default router;
