import mongoose from 'mongoose';

const aiChatMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: true }
);

aiChatMessageSchema.index({ userId: 1, createdAt: 1 });

export default mongoose.model('AiChatMessage', aiChatMessageSchema);
