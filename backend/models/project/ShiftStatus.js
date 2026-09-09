const mongoose = require('mongoose');

// One record per (date, shift) — NOT per day. A day can have Shift I rained
// out / breakdown-affected while Shift II or III ran fine, so "non-working"
// must be scoped to a single shift, never the whole day.
const shiftStatusSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    shift: { type: String, enum: ['I', 'II', 'III', 'General'], required: true },
    status: { type: String, enum: ['working', 'non-working'], default: 'working' },
    remark: { type: String, trim: true }, // e.g. "Idle due to Rain", "Breakdown - excavator down"
  },
  { timestamps: true }
);

shiftStatusSchema.index({ date: 1, shift: 1 }, { unique: true });

module.exports = shiftStatusSchema;
