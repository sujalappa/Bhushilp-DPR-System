const mongoose = require('mongoose');

// One entry per (date, shift) — this is the site-wide "combined production"
// figure from the supervisor/project manager (per the workbook's Read Me
// sheet), not per-vehicle like the shift card. Hard OB / Soft OB / OB
// Rehandling were the only ones ever actually filled in the real data —
// Target was never used in practice, but the field stays optional in case a
// project wants to track it going forward.
const dailyProductionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    shift: { type: String, enum: ['I', 'II', 'III', 'General'], required: true },
    hardOB: Number,
    softOB: Number,
    obRehandling: Number,
    target: Number,
    remark: { type: String, trim: true },
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

dailyProductionSchema.index({ date: 1, shift: 1 }, { unique: true });

module.exports = dailyProductionSchema;
