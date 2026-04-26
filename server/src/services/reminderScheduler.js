import cron from 'node-cron';
import User from '../models/User.js';
import PendingTransaction from '../models/PendingTransaction.js';
import EmailDispatchLog from '../models/EmailDispatchLog.js';
import { sendEmail, emailEnabled, formatInr, verifyMailerConnection } from './mailer.js';
import { buildMonthlyStatement } from './monthlyStatement.js';
import { buildStatementPdfBuffer } from './statementPdf.js';

const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || 'Asia/Kolkata';

function nowPartsInTz(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REMINDER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return { year: get('year'), month: get('month'), day: get('day') };
}

function prevMonthKey(date = new Date()) {
  const { year, month } = nowPartsInTz(date);
  const y = Number(year);
  const m = Number(month);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function dayPeriodKey(date = new Date()) {
  const { year, month, day } = nowPartsInTz(date);
  return `${year}-${month}-${day}`;
}

function hourInTz(date = new Date()) {
  const value = new Intl.DateTimeFormat('en-US', {
    timeZone: REMINDER_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).format(date);
  return Number(value);
}

async function wasSent(userId, kind, periodKey) {
  const row = await EmailDispatchLog.findOne({ userId, kind, periodKey }).lean();
  return Boolean(row);
}

async function markSent(userId, kind, periodKey) {
  await EmailDispatchLog.updateOne(
    { userId, kind, periodKey },
    { $setOnInsert: { userId, kind, periodKey } },
    { upsert: true }
  );
}

async function sendWelcomeEmail(user) {
  await sendEmail({
    to: user.email,
    subject: 'Welcome to Spendly',
    text: `Hi ${user.name}, welcome to Spendly. Start tracking expenses, debts, and monthly statements from today.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="margin:0 0 12px">Welcome to Spendly, ${user.name}!</h2>
        <p style="margin:0 0 10px">Your account is ready.</p>
        <p style="margin:0 0 10px">Track expenses daily, manage pending debts, and get monthly statements automatically.</p>
        <p style="margin:0;color:#64748b;font-size:13px">Happy budgeting,<br/>Spendly</p>
      </div>
    `,
  });
}

export async function runExpenseReminder() {
  const periodKey = dayPeriodKey();
  const users = await User.find({}, { name: 1, email: 1, emailPreferences: 1 }).lean();
  const stats = {
    periodKey,
    usersScanned: users.length,
    optedOut: 0,
    alreadySent: 0,
    sent: 0,
    failed: 0,
  };
  for (const user of users) {
    if (user.emailPreferences?.expenseReminder === false) {
      stats.optedOut += 1;
      continue;
    }
    if (await wasSent(user._id, 'daily_expense_reminder', periodKey)) {
      stats.alreadySent += 1;
      continue;
    }
    try {
      await sendEmail({
        to: user.email,
        subject: '9PM reminder: Add today\'s expenses',
        text: `Hi ${user.name}, this is your daily reminder to add today's expenses in Spendly.`,
        html: `
<div style="background-color:#f8fafc;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b">
  <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06)">
    <div style="background-color:#6366f1;padding:24px;text-align:center">
      <h2 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">Daily Expense Reminder</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;font-size:16px">Hi <strong>${user.name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569">
        It's 9 PM. Don't forget to log your expenses for today! Keeping your records updated daily ensures your monthly insights remain accurate.
      </p>
      
      <div style="text-align:center;margin-bottom:8px">
        <a href="${process.env.FRONTEND_URL?.split(',')[0] || 'https://spendly.example.com'}/transactions?add=true" style="display:inline-block;background-color:#6366f1;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 4px 6px -1px rgba(99,102,241,0.2)">
          Add Today's Expenses
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center">
      <p style="margin:0;font-size:13px;color:#94a3b8">
        Stay on top of your budget with Spendly.
      </p>
    </div>
  </div>
</div>
`,
      });
      await markSent(user._id, 'daily_expense_reminder', periodKey);
      stats.sent += 1;
    } catch (e) {
      stats.failed += 1;
      console.error(`Failed expense reminder for ${user.email}:`, e.message);
    }
  }
  console.log(`[JOB:expense-reminder] Finished:`, stats);
  return stats;
}

export async function runPendingDebtReminder() {
  const periodKey = dayPeriodKey();
  const users = await User.find({}, { name: 1, email: 1, emailPreferences: 1 }).lean();
  const stats = {
    periodKey,
    usersScanned: users.length,
    optedOut: 0,
    alreadySent: 0,
    noPendingDebt: 0,
    sent: 0,
    failed: 0,
  };
  for (const user of users) {
    if (user.emailPreferences?.pendingDebtReminder === false) {
      stats.optedOut += 1;
      continue;
    }
    if (await wasSent(user._id, 'daily_pending_reminder', periodKey)) {
      stats.alreadySent += 1;
      continue;
    }
      try {
        const pendingItems = await PendingTransaction.find({
          userId: user._id,
          status: 'pending'
        }).sort({ date: -1 }).limit(10).lean();

        if (!pendingItems.length) {
          stats.noPendingDebt += 1;
          continue;
        }

        const aggregateData = await PendingTransaction.aggregate([
          { $match: { userId: user._id, status: 'pending' } },
          { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
        ]);
        
        const totalAmount = aggregateData[0]?.total || 0;
        const totalCount = aggregateData[0]?.count || 0;

        const itemsHtml = pendingItems.map(item => `
          <tr style="border-bottom:1px solid #f1f5f9">
            <td style="padding:10px 0;font-size:14px;color:#1e293b">${item.personName} <span style="color:#94a3b8;font-size:12px">(${item.category})</span></td>
            <td style="padding:10px 0;font-size:14px;color:#0f172a;text-align:right;font-weight:600">${formatInr(item.amount)}</td>
          </tr>
        `).join('');

        await sendEmail({
          to: user.email,
          subject: '10PM reminder: Review pending debts',
          text: `Hi ${user.name}, you have ${totalCount} pending item(s) totaling ${formatInr(totalAmount)}.`,
        html: `
<div style="background-color:#f8fafc;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b">
  <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06)">
    <div style="background-color:#10b981;padding:24px;text-align:center">
      <h2 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">Spendly Debt Reminder</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;font-size:16px">Hi <strong>${user.name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569">
        You have <strong>${totalCount}</strong> pending items. Here is a summary of your recent pending debts:
      </p>
      
      <div style="margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid #f1f5f9">
              <th style="text-align:left;padding-bottom:8px;font-size:13px;color:#64748b;text-transform:uppercase">Person</th>
              <th style="text-align:right;padding-bottom:8px;font-size:13px;color:#64748b;text-transform:uppercase">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding:16px 0 8px;font-size:14px;color:#0f172a;font-weight:700">Total Balance</td>
              <td style="padding:16px 0 8px;font-size:16px;color:#10b981;text-align:right;font-weight:800">${formatInr(totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
        ${totalCount > 10 ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;text-align:center">Showing top 10 items. Open the app to see all.</p>` : ''}
      </div>

      <div style="text-align:center">
        <a href="${process.env.FRONTEND_URL?.split(',')[0] || 'https://spendly.example.com'}/pending" style="display:inline-block;background-color:#10b981;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 4px 6px -1px rgba(16,185,129,0.2)">
          Settle or Update
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center">
      <p style="margin:0;font-size:13px;color:#94a3b8">
        This is an automated reminder from your Spendly account.
      </p>
    </div>
  </div>
</div>
`,
      });
      await markSent(user._id, 'daily_pending_reminder', periodKey);
      stats.sent += 1;
    } catch (e) {
      stats.failed += 1;
      console.error(`Failed pending reminder for ${user.email}:`, e.message);
    }
  }
  console.log(`[JOB:pending-reminder] Finished:`, stats);
  return stats;
}

export async function runMonthlyStatementEmail(overrideMonth) {
  const statementMonth = overrideMonth || prevMonthKey();
  const users = await User.find({}, { name: 1, email: 1, emailPreferences: 1 }).lean();
  const stats = {
    statementMonth,
    usersScanned: users.length,
    optedOut: 0,
    alreadySent: 0,
    sent: 0,
    failed: 0,
  };
  for (const user of users) {
    if (user.emailPreferences?.monthlyStatement === false) {
      stats.optedOut += 1;
      continue;
    }
    const periodKey = statementMonth;
    if (await wasSent(user._id, 'monthly_statement', periodKey)) {
      stats.alreadySent += 1;
      continue;
    }
    try {
      const statement = await buildMonthlyStatement(user._id, statementMonth);
      const pdfBuffer = await buildStatementPdfBuffer({
        statement,
        userName: user.name,
        userEmail: user.email,
      });
      await sendEmail({
        to: user.email,
        subject: `Spendly Monthly Statement — ${statement.monthLabel}`,
        text: `Hi ${user.name}, ${statement.monthLabel} summary:\nOpening: ${formatInr(statement.openingBalance)}\nIncome: ${formatInr(statement.income)}\nExpenses: ${formatInr(statement.expenses)}\nNet: ${formatInr(statement.net)}\nClosing: ${formatInr(statement.closingBalance)}\nTransactions: ${statement.transactionCount}`,
        html: `
<div style="background-color:#f8fafc;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#1e293b">
  <div style="max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06)">
    <div style="background-color:#0f172a;padding:24px;text-align:center">
      <h2 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">Monthly Statement: ${statement.monthLabel}</h2>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 20px;font-size:16px">Hi <strong>${user.name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:15px;color:#475569">
        Your monthly financial summary for <strong>${statement.monthLabel}</strong> is ready. We've attached a detailed PDF statement for your records.
      </p>
      
      <div style="background-color:#f1f5f9;border-radius:10px;padding:24px;margin-bottom:24px">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#64748b">Opening Balance</td>
            <td style="padding:4px 0;font-size:14px;color:#0f172a;text-align:right;font-weight:600">${formatInr(statement.openingBalance)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#10b981">Total Income</td>
            <td style="padding:4px 0;font-size:14px;color:#10b981;text-align:right;font-weight:600">+${formatInr(statement.income)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;font-size:14px;color:#ef4444">Total Expenses</td>
            <td style="padding:4px 0;font-size:14px;color:#ef4444;text-align:right;font-weight:600">-${formatInr(statement.expenses)}</td>
          </tr>
          <tr style="border-top:1px solid #e2e8f0">
            <td style="padding:12px 0 4px;font-size:15px;color:#0f172a;font-weight:700">Closing Balance</td>
            <td style="padding:12px 0 4px;font-size:15px;color:#0f172a;text-align:right;font-weight:800">${formatInr(statement.closingBalance)}</td>
          </tr>
        </table>
      </div>

      <div style="text-align:center">
        <a href="${process.env.FRONTEND_URL?.split(',')[0] || 'https://spendly.example.com'}/stats" style="display:inline-block;background-color:#0f172a;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          View Full Insights
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;background-color:#f8fafc;border-top:1px solid #f1f5f9;text-align:center">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        This statement was generated automatically on the 1st of the month.
      </p>
    </div>
  </div>
</div>
`,
        attachments: [
          {
            filename: `Spendly-statement-${statement.monthKey}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      await markSent(user._id, 'monthly_statement', periodKey);
      stats.sent += 1;
    } catch (e) {
      stats.failed += 1;
      console.error(`Failed monthly statement for ${user.email}:`, e.message);
    }
  }
  console.log(`[JOB:monthly-statement] Finished:`, stats);
  return stats;
}

async function runStartupCatchup() {
  try {
    const hr = hourInTz();
    if (hr >= 21) {
      await runExpenseReminder();
    }
    if (hr >= 22) {
      await runPendingDebtReminder();
    }
  } catch (e) {
    console.error('Startup reminder catch-up failed:', e.message);
  }
}

export async function triggerWelcomeEmail(user) {
  if (!emailEnabled() || !user?.email) return;
  if (user?.emailPreferences?.welcomeSignup === false) return;
  try {
    await sendWelcomeEmail(user);
  } catch (e) {
    console.error(`Failed welcome email for ${user.email}:`, e.message);
    throw e;
  }
}

export function startReminderScheduler() {
  if (!emailEnabled()) {
    console.warn('Email scheduler disabled: SMTP env vars are missing.');
    return;
  }

  verifyMailerConnection().then((status) => {
    if (!status.ok) {
      console.warn(`SMTP verify failed: ${status.reason}`);
    } else {
      console.log('SMTP connection verified.');
      runStartupCatchup().catch(() => { });
    }
  });

  cron.schedule(
    '0 21 * * *',
    () => {
      runExpenseReminder().catch((e) => console.error('Expense reminder job failed:', e.message));
    },
    { timezone: REMINDER_TIMEZONE }
  );

  cron.schedule(
    '0 22 * * *',
    () => {
      runPendingDebtReminder().catch((e) => console.error('Pending debt reminder job failed:', e.message));
    },
    { timezone: REMINDER_TIMEZONE }
  );

  cron.schedule(
    '0 9 1 * *',
    () => {
      runMonthlyStatementEmail().catch((e) => console.error('Monthly statement job failed:', e.message));
    },
    { timezone: REMINDER_TIMEZONE }
  );

  console.log(`Email reminder scheduler started in timezone ${REMINDER_TIMEZONE}`);
}
