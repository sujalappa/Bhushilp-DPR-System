const mongoose = require('mongoose');

// A mine level in an underground project, e.g. "-370". Each level carries
// its own conversion factors — how tubs become tons and tons become m3
// there — because tub size and rock density differ between levels. They're
// applied when figures are read, never stored on an entry, so correcting a
// factor corrects every figure derived from it.
const levelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    tonsPerTub: { type: Number, default: 1.5, min: 0 },
    tonsPerCubicMetre: { type: Number, default: 3.5, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = levelSchema;
