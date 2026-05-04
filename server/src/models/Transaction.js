import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['income', 'expense', 'transfer', 'balance_update', 'credit_expense', 'credit_payment'],
      required: true,
    },
    /** For income/expense/transfer: non-negative. For balance_update: signed delta applied to the account. */
    amount: { type: Number, required: true },
    category: { type: String, required: true, trim: true },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    accountName: { type: String, trim: true },
    accountType: { type: String },
    fromAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    fromAccountName: { type: String, trim: true },
    fromAccountType: { type: String },
    toAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
    toAccountName: { type: String, trim: true },
    toAccountType: { type: String },
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
