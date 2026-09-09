const mongoose = require('mongoose');

// Unlike the shift card, the real data showed `Shift` was never actually
// filled in this sheet — fuel is issued once a day per vehicle, not per
// shift — so this is keyed on (date, vehicle) only. Applies to every piece
// of equipment (including excavators/dozers), not just hauling vehicles.
// Of the numeric columns, only `fuelIssued` was consistently filled in the
// real data; the rest stay optional for a site that wants stricter
// reconciliation. `dieselConsumed`/`fuelPerKm` are computed on read, not
// stored, same reasoning as Daily Production's Total Cum.
const fuelLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    openingKm: Number,
    closingKm: Number,
    openingFuel: Number,
    fuelIssued: Number,
    closingFuel: Number,
    remark: { type: String, trim: true },
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

fuelLogSchema.index({ date: 1, vehicleId: 1 }, { unique: true });

module.exports = fuelLogSchema;
