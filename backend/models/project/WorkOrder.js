const mongoose = require('mongoose');

// A contract under which an underground mine is worked, e.g. 9100005472.
// Every Level Production and Development entry belongs to one. It carries
// the rates its labour and billing figures are worked out with, because
// those are set per contract: labour m³ = wage × (1 + markup%) × man-shifts
// ÷ rate per m³, and billing = (production m³ + labour m³) × rate per m³.
const workOrderSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    ratePerCubicMetre: { type: Number, default: 990.67, min: 0 },
    drillerWage: { type: Number, default: 827, min: 0 },
    helperWage: { type: Number, default: 693, min: 0 },
    wageMarkupPct: { type: Number, default: 23.33, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

workOrderSchema.index({ number: 1 }, { unique: true });

module.exports = workOrderSchema;
