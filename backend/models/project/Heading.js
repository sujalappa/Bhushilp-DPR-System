const mongoose = require('mongoose');

// A development heading: one place being driven on a level, e.g. the
// "Ore Drive" or "Cross Cut" on -170. `kind` is the type of work, which
// also names the heading unless it's 'other', and decides what the entry
// form asks for (an ore drive has no filling). `openingProgress` is the metres
// already driven before entries started in this app, so the running total
// continues from where the old workbook left off.
const headingSchema = new mongoose.Schema(
  {
    levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ['ore-drive', 'cross-cut', 'bottom-jigger', 'other'], default: 'other' },
    openingProgress: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = headingSchema;
