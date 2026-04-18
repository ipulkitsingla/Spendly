import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    isCustom: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    categories: {
      type: [categorySchema],
      default: () =>
        [
          'Food',
          'Travel',
          'Bills',
          'Shopping',
          'Entertainment',
          'Health',
          'Transport',
          'Salary',
          'Debt',
          'Other',
        ].map((name) => ({ name, isCustom: false })),
    },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
