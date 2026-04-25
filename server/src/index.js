import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/accounts.js';
import transactionRoutes from './routes/transactions.js';
import pendingRoutes from './routes/pending.js';
import categoryRoutes from './routes/categories.js';
import statsRoutes from './routes/stats.js';
import { startReminderScheduler } from './services/reminderScheduler.js';

const app = express();
const PORT = process.env.PORT || 5000;

const frontendOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors(
    frontendOrigins.length
      ? { origin: frontendOrigins, credentials: true }
      : { origin: true, credentials: true }
  )
);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/pending', pendingRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stats', statsRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/spendly')
  .then(() => {
    startReminderScheduler();
    app.listen(PORT, () => {
      console.log(`Spendly API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
