import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

import { verifyMailerConnection } from '../src/services/mailer.js';

console.log('Testing SMTP connection for:', {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  from: process.env.EMAIL_FROM,
  passSet: Boolean(process.env.SMTP_PASS)
});

async function run() {
  const result = await verifyMailerConnection();
  if (result.ok) {
    console.log('✅ SMTP connection verified successfully!');
  } else {
    console.error('❌ SMTP verification failed:');
    console.error('  Reason:', result.reason);
    if (result.details) console.error('  Diagnosis:', result.details);
  }
}

run();
