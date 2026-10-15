const mongoose = require('mongoose');
const { HANDLING_TYPES } = require('../../utils/obFactors');

const shiftLogSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    shift: { type: String, enum: ['I', 'II', 'III', 'General'], required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    // One ShiftLog per driver who actually touched this vehicle this shift
    // (see the unique index below) — a mid-shift driver handover creates a
    // second record instead of overwriting the first, so D1's KM/Hrs/trips
    // stay exactly as D1 left them and D2 starts a clean segment. `null`
    // means "no driver was ever assigned" (e.g. vehicle sat idle all shift),
    // and the unique index still limits a vehicle+shift to at most one such
    // driverless record.
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null },
    // This vehicle's own status for this shift — independent of ShiftStatus,
    // so one machine can be down (breakdown) while the rest of the shift
    // works normally. When 'non-working', KM/Hrs/trip fields are expected
    // to stay blank rather than be forced to 0.
    status: { type: String, enum: ['working', 'non-working'], default: 'working' },
    startKm: Number,
    closeKm: Number,
    startHrs: Number,
    closeHrs: Number,
    // Shown on the card as "Fuel Issued" (litres) and "Fuel Issued KM"
    // (odometer reading when it was issued). Field names kept from when
    // these were opening/closing fuel, so existing entries still read.
    fuelOpen: Number,
    fuelClose: Number,
    // Which column of Daily Production this entry's trips count towards.
    // Trips × the per-trip figure in utils/obFactors.
    handlingType: { type: String, enum: HANDLING_TYPES, default: 'ob-rehandling' },
    // The trip count for this driver segment, written down directly by
    // whoever reviews the card — required for every working segment
    // (enforced in the controller). This is the ONLY number every
    // trip-count calculation uses (OB Rehandling, Soft OB, the driver rewards
    // leaderboard — see utils/tripCount). Individual Trip
    // documents below are detail records only (loading/unloading time,
    // machine, loading point per trip) and are never counted towards a
    // total — matching how the real paper process was actually filled in.
    totalTripsManual: { type: Number, min: 0 },
    remark: { type: String, trim: true }, // required in practice when status is 'non-working' (enforced in controller)
    // Lives in the central DB (different connection) — stored as a plain id,
    // not populate-able via `ref` across connections.
    createdBy: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true }
);

// One record per driver-segment: (date, shift, vehicle, driver) is the real
// unique key now, not (date, shift, vehicle) — that's what makes a mid-shift
// driver change additive instead of destructive.
shiftLogSchema.index({ date: 1, shift: 1, vehicleId: 1, driverId: 1 }, { unique: true });
// Dashboard/reporting access patterns: "this vehicle's history" and
// "this driver's trip/shift history" (the rewards leaderboard).
shiftLogSchema.index({ vehicleId: 1, date: 1 });
shiftLogSchema.index({ driverId: 1, date: 1 });

module.exports = shiftLogSchema;
