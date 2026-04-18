import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['cash', 'online', 'card', 'custom'], default: 'custom' },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

accountSchema.index({ userId: 1, name: 1 });

export default mongoose.model('Account', accountSchema);
