import { runMonthlyStatementEmail } from '../../src/services/reminderScheduler.js';

export default async function handler(req, res) {
  console.log('CRON: Monthly statement triggered');
  await runMonthlyStatementEmail();
  res.status(200).json({ ok: true });
}
