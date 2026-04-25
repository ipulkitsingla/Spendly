import { runPendingDebtReminder } from '../services/reminderScheduler.js';
import { runReminderJob } from './runReminderJob.js';

runReminderJob({
  name: 'pending-reminder-job',
  run: runPendingDebtReminder,
})
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
