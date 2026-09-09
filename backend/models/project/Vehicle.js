const mongoose = require('mongoose');

// Exported as a Schema (not a compiled Model) because it must be bound to a
// per-project connection at request time — see config/projectDb.js.
const vehicleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    regNo: { type: String, trim: true },
    category: {
      type: String,
      enum: ['tipper', 'dumper', 'excavator', 'dozer', 'loader', 'other'],
      default: 'other',
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = vehicleSchema;
