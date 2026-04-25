import 'dotenv/config';
import mongoose from 'mongoose';
import { emailEnabled, verifyMailerConnection } from '../services/mailer.js';

export async function runReminderJob({ name, run }) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spendly';
  if (!emailEnabled()) {
    throw new Error(`${name}: SMTP env vars missing`);
  }

  await mongoose.connect(mongoUri);
  try {
    const verify = await verifyMailerConnection();
    if (!verify.ok) {
      throw new Error(`${name}: SMTP verify failed (${verify.reason})`);
    }
    await run();
    console.log(`${name}: success`);
  } finally {
    await mongoose.disconnect();
  }
}
