import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['cash', 'online', 'card', 'credit', 'custom'], default: 'custom' },
    balance: { type: Number, default: 0 },
    // Credit-specific fields
    creditLimit: { type: Number, default: 0 },
    billedAmount: { type: Number, default: 0 },
    unbilledAmount: { type: Number, default: 0 },
    lastBilledDate: { type: Date },
    billingDate: { type: Number }, // 1-31
    dueDate: { type: Number }, // 1-31
  },
  { timestamps: true }
);

accountSchema.index({ userId: 1, name: 1 });

export default mongoose.model('Account', accountSchema);
