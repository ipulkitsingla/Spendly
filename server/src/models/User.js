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
    emailPreferences: {
      monthlyStatement: { type: Boolean, default: true },
      expenseReminder: { type: Boolean, default: true },
      pendingDebtReminder: { type: Boolean, default: true },
      welcomeSignup: { type: Boolean, default: true },
    },
    monthlyBudget: { type: Number, default: 0 },
    resetOtp: { type: String },
    resetOtpExpires: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
