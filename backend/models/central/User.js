const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    forms: [
      {
        type: String,
        enum: [
          'shift-card',
          'fuel',
          'breakdown',
          'trip-management',
          'production',
          'utilization',
          'site-monitoring',
        ],
        required: true,
      },
    ],
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    isSuperAdmin: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    assignments: { type: [assignmentSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// passwordHash must never leave the server — strip it (and __v) from every
// JSON response by default so a controller can't accidentally leak it.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
