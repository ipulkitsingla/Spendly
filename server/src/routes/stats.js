import { Router } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

router.get('/summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: 'Valid "from" and "to" ISO dates are required' });
    }
    const userId = new mongoose.Types.ObjectId(req.userId);

    const txs = await Transaction.find({
      userId,
      date: { $gte: fromDate, $lte: toDate },
    }).lean();

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap = {};

    for (const tx of txs) {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
        categoryMap[tx.category] = categoryMap[tx.category] || { income: 0, expense: 0 };
        categoryMap[tx.category].income += tx.amount;
      } else if (tx.type === 'expense') {
        totalExpense += tx.amount;
        categoryMap[tx.category] = categoryMap[tx.category] || { income: 0, expense: 0 };
        categoryMap[tx.category].expense += tx.amount;
      }
    }

    const byCategory = Object.entries(categoryMap).map(([name, v]) => ({
      name,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));

    res.json({
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      byCategory,
      transferCount: txs.filter((t) => t.type === 'transfer').length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

/** Buckets: day (YYYY-MM-DD), week (YYYY-Www), month (YYYY-MM) */
router.get('/timeseries', async (req, res) => {
  try {
    const { from, to, bucket = 'day' } = req.query;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (!fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: 'Valid "from" and "to" ISO dates are required' });
    }
    const userId = new mongoose.Types.ObjectId(req.userId);

    let format;
    if (bucket === 'week') format = '%G-W%V';
    else if (bucket === 'month') format = '%Y-%m';
    else format = '%Y-%m-%d';

    const rows = await Transaction.aggregate([
      {
        $match: {
          userId,
          date: { $gte: fromDate, $lte: toDate },
          type: { $in: ['income', 'expense'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format, date: '$date' } },
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(
      rows.map((r) => ({
        period: r._id,
        income: r.income,
        expense: r.expense,
        net: r.income - r.expense,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load timeseries' });
  }
});

export default router;
