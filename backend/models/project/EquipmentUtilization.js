const mongoose = require('mongoose');

// Equipment utilization for one shift: one record per vehicle, plus at most
// one "whole shift" record (vehicleId null) for time every machine lost
// together — rain, a blockade. Working hours default to what the vehicle's
// Shift Card says (closing − starting hrs), so `workingHrs` is only stored
// when someone sets it; utilization % is worked out when read.
const equipmentUtilizationSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    shift: { type: String, enum: ['I', 'II', 'III', 'General'], required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    availableHrs: { type: Number, min: 0 },
    workingHrs: { type: Number, min: 0 },
    idleHrs: { type: Number, min: 0 },
    breakdownHrs: { type: Number, min: 0 },
    remark: { type: String, trim: true },
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

equipmentUtilizationSchema.index({ date: 1, shift: 1, vehicleId: 1 }, { unique: true });
equipmentUtilizationSchema.index({ vehicleId: 1, date: 1 });

module.exports = equipmentUtilizationSchema;
