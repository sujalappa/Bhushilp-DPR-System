const mongoose = require('mongoose');

// A named member of an underground gang. One list for everyone, with no
// fixed trade: the same person can be a driller one shift and a helper the
// next, so the trade is recorded on the entry, not on the person.
const workerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = workerSchema;
