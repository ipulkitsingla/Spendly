import { runMonthlyStatementEmail } from '../../src/services/reminderScheduler.js';

export default async function handler(req, res) {
  console.log("CRON: Monthly statement triggered");
  try {
    await runMonthlyStatementEmail();
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Monthly statement failed:", e.message);
    res.status(500).json({ error: e.message });
  }
}
