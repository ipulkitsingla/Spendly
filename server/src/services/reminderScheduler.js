import cron from 'node-cron';
import User from '../models/User.js';
import PendingTransaction from '../models/PendingTransaction.js';
import EmailDispatchLog from '../models/EmailDispatchLog.js';
import { sendEmail, emailEnabled, formatInr } from './mailer.js';
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

async function runExpenseReminder() {
  const periodKey = dayPeriodKey();
  const users = await User.find({}, { name: 1, email: 1, emailPreferences: 1 }).lean();
  for (const user of users) {
    if (user.emailPreferences?.expenseReminder === false) continue;
    if (await wasSent(user._id, 'daily_expense_reminder', periodKey)) continue;
    try {
      await sendEmail({
        to: user.email,
        subject: '9PM reminder: Add today\'s expenses',
        text: `Hi ${user.name}, this is your daily reminder to add today's expenses in Spendly.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
            <h3 style="margin:0 0 10px">Hi ${user.name},</h3>
            <p style="margin:0 0 10px">It is 9PM. Add your expenses for today so your monthly totals stay accurate.</p>
            <p style="margin:0;color:#64748b;font-size:13px">Spendly daily reminder</p>
          </div>
        `,
      });
      await markSent(user._id, 'daily_expense_reminder', periodKey);
    } catch (e) {
      console.error(`Failed expense reminder for ${user.email}:`, e.message);
    }
  }
}

async function runPendingDebtReminder() {
  const periodKey = dayPeriodKey();
  const users = await User.find({}, { name: 1, email: 1, emailPreferences: 1 }).lean();
  for (const user of users) {
    if (user.emailPreferences?.pendingDebtReminder === false) continue;
    if (await wasSent(user._id, 'daily_pending_reminder', periodKey)) continue;
    try {
      const pendingCount = await PendingTransaction.countDocuments({ userId: user._id, status: 'pending' });
      if (!pendingCount) continue;
      await sendEmail({
        to: user.email,
        subject: '10PM reminder: Review pending debts',
        text: `Hi ${user.name}, you still have ${pendingCount} pending debt item(s) in Spendly.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
            <h3 style="margin:0 0 10px">Hi ${user.name},</h3>
            <p style="margin:0 0 10px">You currently have <strong>${pendingCount}</strong> pending debt item(s).</p>
            <p style="margin:0 0 10px">Please review and settle/update them in Spendly.</p>
            <p style="margin:0;color:#64748b;font-size:13px">Spendly debt reminder</p>
          </div>
        `,
      });
      await markSent(user._id, 'daily_pending_reminder', periodKey);
    } catch (e) {
      console.error(`Failed pending reminder for ${user.email}:`, e.message);
    }
  }
}

async function runMonthlyStatementEmail() {
  const statementMonth = prevMonthKey();
  const users = await User.find({}, { name: 1, email: 1, emailPreferences: 1 }).lean();
  for (const user of users) {
    if (user.emailPreferences?.monthlyStatement === false) continue;
    const periodKey = statementMonth;
    if (await wasSent(user._id, 'monthly_statement', periodKey)) continue;
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
          <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
            <h2 style="margin:0 0 12px">Monthly Statement: ${statement.monthLabel}</h2>
            <p style="margin:0 0 10px">Hi ${user.name}, here is your Spendly monthly summary.</p>
            <ul style="margin:0 0 12px 18px;padding:0">
              <li>Opening balance: <strong>${formatInr(statement.openingBalance)}</strong></li>
              <li>Total income: <strong>${formatInr(statement.income)}</strong></li>
              <li>Total expenses: <strong>${formatInr(statement.expenses)}</strong></li>
              <li>Net: <strong>${formatInr(statement.net)}</strong></li>
              <li>Closing balance: <strong>${formatInr(statement.closingBalance)}</strong></li>
              <li>Transactions: <strong>${statement.transactionCount}</strong></li>
            </ul>
            <p style="margin:0;color:#64748b;font-size:13px">This statement is generated automatically on the 1st of each month.</p>
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
    } catch (e) {
      console.error(`Failed monthly statement for ${user.email}:`, e.message);
    }
  }
}

export function triggerWelcomeEmail(user) {
  if (!emailEnabled() || !user?.email) return;
  if (user?.emailPreferences?.welcomeSignup === false) return;
  sendWelcomeEmail(user).catch((e) => {
    console.error(`Failed welcome email for ${user.email}:`, e.message);
  });
}

export function startReminderScheduler() {
  if (!emailEnabled()) {
    console.warn('Email scheduler disabled: SMTP env vars are missing.');
    return;
  }

  cron.schedule('0 21 * * *', () => {
    runExpenseReminder().catch((e) => console.error('Expense reminder job failed:', e.message));
  }, { timezone: REMINDER_TIMEZONE });

  cron.schedule('0 22 * * *', () => {
    runPendingDebtReminder().catch((e) => console.error('Pending debt reminder job failed:', e.message));
  }, { timezone: REMINDER_TIMEZONE });

  cron.schedule('0 9 1 * *', () => {
    runMonthlyStatementEmail().catch((e) => console.error('Monthly statement job failed:', e.message));
  }, { timezone: REMINDER_TIMEZONE });

  console.log(`Email reminder scheduler started in timezone ${REMINDER_TIMEZONE}`);
}
