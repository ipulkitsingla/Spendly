import { runExpenseReminder } from '../../src/services/reminderScheduler.js';

export default async function handler(req, res) {
  await runExpenseReminder();
  res.status(200).json({ ok: true });
}