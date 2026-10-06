const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const listShiftLogs = asyncHandler(async (req, res) => {
  const { ShiftLog } = req.projectModels;
  const { date, shift } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);

  const logs = await ShiftLog.find({ date: new Date(date), shift })
    .populate('vehicleId', 'name category')
    .populate('driverId', 'name')
    .sort({ createdAt: 1 });

  res.status(200).json({ success: true, data: logs });
});

const getShiftLog = asyncHandler(async (req, res) => {
  const { ShiftLog } = req.projectModels;
  const log = await ShiftLog.findById(req.params.shiftLogId)
    .populate('vehicleId', 'name category')
    .populate('driverId', 'name');
  if (!log) throw new AppError('Shift log not found', 404);

  res.status(200).json({ success: true, data: log });
});

// Upsert on (date, shift, vehicleId, driverId) — one header per DRIVER
// SEGMENT, not just per vehicle per shift. A mid-shift driver change is a
// second segment, not an overwrite: D1's saved KM/Hrs/trips are untouched,
// D2 gets their own fresh record. Called every time the clerk saves the
// header block on the Vehicle shift screen for a given driver.
const upsertShiftLog = asyncHandler(async (req, res) => {
  const { ShiftLog, Vehicle } = req.projectModels;
  const {
    date, shift, vehicleId, driverId, status,
    startKm, closeKm, startHrs, closeHrs, fuelOpen, fuelClose, remark, totalTripsManual,
  } = req.body;

  if (!date || !shift || !vehicleId) {
    throw new AppError('date, shift and vehicleId are required', 400);
  }

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  const resolvedStatus = status || 'working';
  if (resolvedStatus === 'non-working' && !remark) {
    throw new AppError('A remark is required when marking a vehicle non-working', 400);
  }
  if (resolvedStatus === 'working' && !driverId) {
    throw new AppError('A driver is required to log a working shift segment', 400);
  }
  if (resolvedStatus === 'working' && (totalTripsManual === '' || totalTripsManual == null)) {
    throw new AppError('Total Trips is required for a working shift segment', 400);
  }

  // Normalized to `null` (never `undefined`) so every request that omits a
  // driver resolves to the same single "no driver assigned" record for this
  // vehicle+shift, instead of the unique index seeing inconsistent values.
  const driverKey = driverId || null;

  const setFields = {
    date: new Date(date),
    shift,
    vehicleId,
    driverId: driverKey,
    status: resolvedStatus,
    remark,
    createdBy: req.user._id,
  };
  // Numeric fields only meaningful when the vehicle actually ran this shift.
  if (resolvedStatus === 'working') {
    Object.assign(setFields, { startKm, closeKm, startHrs, closeHrs, fuelOpen, fuelClose });
    // The count that drives every calculation (OB Rehandling, the driver
    // rewards leaderboard) — required, and always wins over however many
    // individual Trip rows happen to exist below (those are detail records
    // only, e.g. loading/unloading time per trip; they're never counted).
    setFields.totalTripsManual = Number(totalTripsManual);
  }

  const log = await ShiftLog.findOneAndUpdate(
    { date: new Date(date), shift, vehicleId, driverId: driverKey },
    { $set: setFields },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  // Kept consistent with listShiftLogs/getShiftLog, which both populate —
  // otherwise a screen relying on the save response instead of re-fetching
  // would see raw ObjectIds instead of {_id, name}.
  await log.populate('vehicleId', 'name category');
  await log.populate('driverId', 'name');

  res.status(200).json({ success: true, data: log });
});

// Removes one driver's segment (and its trips) for this vehicle+shift only —
// e.g. a driver picked by mistake. Never touches the Driver/Vehicle master
// records, so the name stays available (and correct) for every other shift.
const deleteShiftLog = asyncHandler(async (req, res) => {
  const { ShiftLog, Trip } = req.projectModels;
  const log = await ShiftLog.findById(req.params.shiftLogId);
  if (!log) throw new AppError('Shift log not found', 404);

  await Trip.deleteMany({ shiftLogId: log._id });
  await log.deleteOne();

  res.status(200).json({ success: true, data: { _id: req.params.shiftLogId } });
});

module.exports = { listShiftLogs, getShiftLog, upsertShiftLog, deleteShiftLog };
