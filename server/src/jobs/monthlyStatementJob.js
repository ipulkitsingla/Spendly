import { runMonthlyStatementEmail } from '../services/reminderScheduler.js';
import { runReminderJob } from './runReminderJob.js';

runReminderJob({
  name: 'monthly-statement-job',
  run: runMonthlyStatementEmail,
})
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
