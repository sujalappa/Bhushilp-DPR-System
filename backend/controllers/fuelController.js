const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { assertNotBelow } = require('../utils/readings');
const { round } = require('../utils/numbers');

// Diesel Consumed = fuel that went into the tank (opening + issued) minus
// what's left (closing) — only meaningful if all three are known. Fuel/KM
// only meaningful if both odometer readings are known too. Computed on
// read so these can never drift from the inputs they're derived from.
function withComputed(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  let dieselConsumed = null;
  if (obj.openingFuel != null && obj.fuelIssued != null && obj.closingFuel != null) {
    dieselConsumed = round(obj.openingFuel + obj.fuelIssued - obj.closingFuel, 2);
  }
  let fuelPerKm = null;
  if (dieselConsumed != null && obj.openingKm != null && obj.closingKm != null && obj.closingKm > obj.openingKm) {
    fuelPerKm = Number((dieselConsumed / (obj.closingKm - obj.openingKm)).toFixed(2));
  }
  return { ...obj, dieselConsumed, fuelPerKm };
}

const listFuelLogs = asyncHandler(async (req, res) => {
  const { FuelLog } = req.projectModels;
  const { date } = req.query;
  if (!date) throw new AppError('date is required', 400);

  const logs = await FuelLog.find({ date: new Date(date) })
    .populate('vehicleId', 'name category')
    .sort({ createdAt: 1 });

  res.status(200).json({ success: true, data: logs.map(withComputed) });
});

const upsertFuelLog = asyncHandler(async (req, res) => {
  const { FuelLog, Vehicle } = req.projectModels;
  const { date, vehicleId, openingKm, closingKm, openingFuel, fuelIssued, closingFuel, remark } = req.body;
  if (!date || !vehicleId) throw new AppError('date and vehicleId are required', 400);
  assertNotBelow(openingKm, closingKm, 'KM');

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  // Blank becomes null (not undefined, which $set would skip), so clearing a
  // previously saved reading actually clears it.
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const setFields = {
    date: new Date(date),
    vehicleId,
    openingKm: num(openingKm),
    closingKm: num(closingKm),
    openingFuel: num(openingFuel),
    fuelIssued: num(fuelIssued),
    closingFuel: num(closingFuel),
    remark: remark || '',
    createdBy: req.user._id,
  };

  const doc = await FuelLog.findOneAndUpdate(
    { date: new Date(date), vehicleId },
    { $set: setFields },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await doc.populate('vehicleId', 'name category');

  res.status(200).json({ success: true, data: withComputed(doc) });
});

const deleteFuelLog = asyncHandler(async (req, res) => {
  const { FuelLog } = req.projectModels;
  const log = await FuelLog.findByIdAndDelete(req.params.fuelLogId);
  if (!log) throw new AppError('Fuel entry not found', 404);

  res.status(200).json({ success: true, data: { _id: req.params.fuelLogId } });
});

module.exports = { listFuelLogs, upsertFuelLog, deleteFuelLog, withComputed };
