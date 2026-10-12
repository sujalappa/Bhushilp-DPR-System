const mongoose = require('mongoose');

// The named person in charge of an underground gang for a shift.
const supervisorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = supervisorSchema;
