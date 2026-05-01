import { runPendingDebtReminder } from '../../src/services/reminderScheduler.js';

export default async function handler(req, res) {
  console.log("CRON: Debt reminder triggered");
  await runPendingDebtReminder();
  res.status(200).json({ ok: true });
}