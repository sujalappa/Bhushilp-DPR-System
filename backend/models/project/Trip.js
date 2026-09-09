const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    shiftLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftLog', required: true },
    // Denormalized from the parent ShiftLog at creation time (see
    // tripController.addTrip) so dashboards can query trips directly —
    // "trips per driver" or "trips per vehicle per day" — without joining
    // through ShiftLog on every request. shiftLogId stays as the source of
    // truth for the relationship; these are a read-optimization copy of it,
    // never edited after the trip is created.
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
    date: { type: Date, required: true },
    shift: { type: String, enum: ['I', 'II', 'III', 'General'], required: true },

    snNo: { type: Number, required: true },
    loadingTime: { type: String, trim: true }, // "HH:mm"
    unloadingTime: { type: String, trim: true }, // "HH:mm"
    machineVehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
    loadingPointId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoadingPoint' },
    remarks: { type: String, trim: true },
  },
  { timestamps: true }
);

tripSchema.index({ shiftLogId: 1, snNo: 1 }, { unique: true });
// Dashboard access patterns: driver leaderboard (rewards), vehicle history,
// date-range production reports.
tripSchema.index({ driverId: 1, date: 1 });
tripSchema.index({ vehicleId: 1, date: 1 });

module.exports = tripSchema;
