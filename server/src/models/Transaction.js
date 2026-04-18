import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['income', 'expense', 'transfer', 'balance_update'],
      required: true,
    },
    /** For income/expense/transfer: non-negative. For balance_update: signed delta applied to the account. */
    amount: { type: Number, required: true },
    category: { type: String, required: true, trim: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    fromAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    toAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    date: { type: Date, required: true },
    note: { type: String, default: '', trim: true },
    balanceAfterTransaction: { type: Number, default: 0 },
    toBalanceAfterTransaction: { type: Number },
    /** Account whose running balance is stored in balanceAfterTransaction (primary leg for transfers) */
    balanceAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, date: -1 });

export default mongoose.model('Transaction', transactionSchema);
