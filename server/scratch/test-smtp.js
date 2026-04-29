import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const config = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000, // 10 seconds
};

console.log('Testing SMTP connection with config:', { ...config, auth: { ...config.auth, pass: '****' } });

async function test() {
  const transporter = nodemailer.createTransport(config);
  try {
    await transporter.verify();
    console.log('✅ Connection verified successfully!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    if (error.code === 'ETIMEDOUT') {
      console.log('\nSuggestion: Port 587 might be blocked. Try port 465 with SMTP_SECURE=true.');
    }
  }
}

test();
