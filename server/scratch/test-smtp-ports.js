import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testConfig(port, secure) {
  const config = {
    host: 'smtp.gmail.com',
    port: port,
    secure: secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5000,
  };

  console.log(`\n--- Testing Port ${port} (secure: ${secure}) ---`);
  const transporter = nodemailer.createTransport(config);
  try {
    await transporter.verify();
    console.log(`✅ Port ${port} worked!`);
  } catch (error) {
    console.error(`❌ Port ${port} failed:`, error.message);
  }
}

async function run() {
  await testConfig(587, false);
  await testConfig(465, true);
}

run();
