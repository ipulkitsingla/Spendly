import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';

let transporter = null;

export function emailEnabled() {
  return Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && EMAIL_FROM);
}

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export async function verifyMailerConnection() {
  if (!emailEnabled()) return { ok: false, reason: 'missing_env' };
  try {
    const t = getTransporter();
    await t.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.message || 'verify_failed' };
  }
}

export async function sendEmail({ to, subject, html, text, attachments }) {
  if (!emailEnabled()) return { skipped: true };
  const t = getTransporter();
  const info = await t.sendMail({
    from: EMAIL_FROM,
    to,
    subject,
    html,
    text,
    attachments: Array.isArray(attachments) ? attachments : undefined,
  });
  return { skipped: false, messageId: info?.messageId || null };
}

export function formatInr(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}
