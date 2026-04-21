import mongoose from 'mongoose';

const emailDispatchLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, required: true, trim: true },
    periodKey: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

emailDispatchLogSchema.index({ userId: 1, kind: 1, periodKey: 1 }, { unique: true });

export default mongoose.model('EmailDispatchLog', emailDispatchLogSchema);
