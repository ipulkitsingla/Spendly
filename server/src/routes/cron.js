import { Router } from 'express';
import { runExpenseReminder, runMonthlyStatementEmail, runPendingDebtReminder, resetEmailLogs } from '../services/reminderScheduler.js';

const router = Router();

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return true; // Allow if not configured (user's request)
  const headerSecret = req.get('x-cron-secret') || req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const querySecret = String(req.query?.key || '');
  return headerSecret === secret || querySecret === secret;
}

function ensureCronAuth(req, res, next) {
  if (!cronAuthorized(req)) {
    return res.status(401).end();
  }
  next();
}

router.get('/health', (_, res) => {
  res.json({ ok: true });
});

router.all('/expense-reminder', ensureCronAuth, async (req, res) => {
  try {
    await runExpenseReminder();
    res.status(200).end();
  } catch (e) {
    console.error('Expense reminder failed:', e);
    res.status(500).end();
  }
});

router.all('/pending-reminder', ensureCronAuth, async (req, res) => {
  try {
    await runPendingDebtReminder();
    res.status(200).end();
  } catch (e) {
    console.error('Pending reminder failed:', e);
    res.status(500).end();
  }
});

router.all('/monthly-statement', ensureCronAuth, async (req, res) => {
  try {
    const month = req.query.month; // e.g. 2026-04
    await runMonthlyStatementEmail(month);
    res.status(200).end();
  } catch (e) {
    console.error('Monthly statement failed:', e);
    res.status(500).end();
  }
});

router.all('/reset-logs', ensureCronAuth, async (req, res) => {
  try {
    const { kind, periodKey } = req.query;
    const filter = {};
    if (kind) filter.kind = kind;
    if (periodKey) filter.periodKey = periodKey;
    const count = await resetEmailLogs(filter);
    res.json({ ok: true, resetCount: count });
  } catch (e) {
    console.error('Reset logs failed:', e);
    res.status(500).end();
  }
});

export default router;
