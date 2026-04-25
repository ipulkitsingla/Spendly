import { runExpenseReminder } from '../services/reminderScheduler.js';
import { runReminderJob } from './runReminderJob.js';

runReminderJob({
  name: 'expense-reminder-job',
  run: runExpenseReminder,
})
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
