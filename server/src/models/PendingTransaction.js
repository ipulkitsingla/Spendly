import mongoose from 'mongoose';

const pendingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    personName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    note: { type: String, default: '', trim: true },
    status: { type: String, enum: ['pending', 'settled'], default: 'pending' },
    settledTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  },
  { timestamps: true }
);

pendingSchema.index({ userId: 1, status: 1 });

export default mongoose.model('PendingTransaction', pendingSchema);
