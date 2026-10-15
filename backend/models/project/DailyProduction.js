const mongoose = require('mongoose');

// One entry per (date, shift) — this is the site-wide "combined production"
// figure from the supervisor/project manager (per the workbook's Read Me
// sheet), not per-vehicle like the shift card. Target was never used in
// practice, but the field stays optional in case a project wants to track
// it going forward.
//
// OB Rehandling and Soft OB are NOT stored here — both are computed on read
// from the Shift Card's trips, each entry counting towards the column it
// was marked as (see dailyProductionController.withComputed). The softOB
// field is left over from before that and is no longer read.
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
