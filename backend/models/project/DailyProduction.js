const mongoose = require('mongoose');

// One entry per (date, shift) — this is the site-wide "combined production"
// figure from the supervisor/project manager (per the workbook's Read Me
// sheet), not per-vehicle like the shift card. Target was never used in
// practice, but the field stays optional in case a project wants to track
// it going forward.
//
// OB Rehandling is NOT stored here — it's computed on read as
// 14 x (sum of ShiftLog.totalTripsManual for that date+shift), see
// dailyProductionController.withComputed and utils/tripCount. Soft OB is locked at 0 in the UI
// for now (the real process doesn't fill it yet); the field stays on the
// schema for when the rehandling formula moves to Soft OB in future.
const dailyProductionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    shift: { type: String, enum: ['I', 'II', 'III', 'General'], required: true },
    hardOB: { type: Number, default: 0 },
    softOB: { type: Number, default: 0 },
    target: Number,
    remark: { type: String, trim: true },
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

dailyProductionSchema.index({ date: 1, shift: 1 }, { unique: true });

module.exports = dailyProductionSchema;
