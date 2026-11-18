import nodemailer from 'nodemailer';

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').trim().toLowerCase() === 'true';
  const user = (process.env.SMTP_USER || '').trim();
  // Strip any internal spaces, leading/trailing spaces or quotes from App Password
  const pass = (process.env.SMTP_PASS || '').replace(/["'\s]/g, '').trim();
  const from = (process.env.EMAIL_FROM || '').trim();

  return { host, port, secure, user, pass, from };
}

let transporter = null;
let lastConfigHash = '';

export function emailEnabled() {
  const { host, user, pass, from } = getSmtpConfig();
  return Boolean(host && user && pass && from);
}

function getTransporter() {
  const cfg = getSmtpConfig();
  const currentHash = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}:${cfg.pass}`;

  if (transporter && lastConfigHash === currentHash) {
    return transporter;
  }

  // If using Gmail, optimize transport settings
  const isGmail = cfg.host.includes('gmail.com');
  const transportOptions = isGmail
    ? {
        service: 'gmail',
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      }
    : {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      };

  transporter = nodemailer.createTransport(transportOptions);
  lastConfigHash = currentHash;
  return transporter;
}

export async function verifyMailerConnection() {
  if (!emailEnabled()) {
    return { ok: false, reason: 'missing_env', details: 'SMTP environment variables are incomplete in .env.' };
  }
  try {
    const t = getTransporter();
    await t.verify();
    return { ok: true };
  } catch (error) {
    const msg = error?.message || 'verify_failed';
    let details = msg;

    if (msg.includes('534-5.7.9') || msg.includes('WebLoginRequired')) {
      details = 'Google blocked automated login (534-5.7.9). Requires a Google App Password (https://myaccount.google.com/apppasswords) with 2-Step Verification enabled, and unlocking external app access at https://accounts.google.com/DisplayUnlockCaptcha.';
    } else if (msg.includes('535') || msg.includes('BadCredentials')) {
      details = 'Invalid Gmail credentials (535-5.7.8). Ensure you are using a 16-character App Password generated specifically for this Gmail account.';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      details = 'SMTP connection timed out. Check if port 587 or 465 is blocked by your ISP or firewall.';
    }

    return { ok: false, reason: msg, code: error?.code, details };
  }
}

export async function sendEmail({ to, subject, html, text, attachments }) {
  if (!emailEnabled()) {
    console.log(`[MAILER] Skipped sending email to ${to} because SMTP credentials are not configured in .env.`);
    return { skipped: true };
  }
  const { from } = getSmtpConfig();
  console.log(`[MAILER] Attempting to send email to ${to}...`);
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from,
      to,
      subject,
      html,
      text,
      attachments: Array.isArray(attachments) ? attachments : undefined,
    });
    console.log(`[MAILER] Successfully sent email to ${to}. Message ID: ${info?.messageId}`);
    return { skipped: false, messageId: info?.messageId || null };
  } catch (error) {
    console.error(`[MAILER] ERROR sending email to ${to}:`, error);
    throw error;
  }
}

export function formatInr(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}
