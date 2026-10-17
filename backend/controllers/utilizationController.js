const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toNumberOrNull, round } = require('../utils/numbers');

// A shift is 8 hours; Available Hrs defaults to that.
const SHIFT_HOURS = 8;
const HOUR_KEYS = ['availableHrs', 'workingHrs', 'idleHrs', 'breakdownHrs'];

// Running hours per vehicle from the shift's Shift Cards (closing − starting
// hrs, over every driver segment), and who drove it.
async function shiftCardHours(models, filter) {
  const logs = await models.ShiftLog.find(filter).populate('vehicleId', 'name category').populate('driverId', 'name');
  const byVehicle = new Map();
  logs.forEach((l) => {
    if (!l.vehicleId) return;
    const key = `${l.date.toISOString()}|${l.shift}|${l.vehicleId._id}`;
    const row = byVehicle.get(key) || { vehicle: l.vehicleId, hours: null, operators: [] };
    if (l.startHrs != null && l.closeHrs != null && l.closeHrs >= l.startHrs) {
      row.hours = round((row.hours || 0) + (l.closeHrs - l.startHrs), 2);
    }
    if (l.driverId?.name && !row.operators.includes(l.driverId.name)) row.operators.push(l.driverId.name);
    byVehicle.set(key, row);
  });
  return byVehicle;
}

// Saved values, with the Shift Card's hours standing in for working hours
// nobody has set, and utilization = working ÷ available.
// `ran` is false for a vehicle with no Shift Card this shift: it didn't
// run, so its working hours are 0 unless someone sets them.
function computed(entry, cardHours, ran = true) {
  const availableHrs = entry?.availableHrs ?? SHIFT_HOURS;
  const workingHrs = entry?.workingHrs ?? (ran ? cardHours ?? null : 0);
  return {
    availableHrs,
    workingHrs,
    idleHrs: entry?.idleHrs ?? null,
    breakdownHrs: entry?.breakdownHrs ?? null,
    utilizationPct: workingHrs != null && availableHrs > 0 ? round((workingHrs / availableHrs) * 100, 1) : null,
  };
}

// Every vehicle of the fleet for the shift, and the whole-shift entry. A
// vehicle with a Shift Card ran (working hours from the card); one without
// counts as not having run — worked out here, never saved, so a card filled
// in late simply turns it into a vehicle that ran. A vehicle counts from
// the day it was added or its first Shift Card, whichever is earlier (an
// imported fleet was added after it started running); inactive ones don't.
const listUtilization = asyncHandler(async (req, res) => {
  const { EquipmentUtilization, Vehicle, ShiftLog } = req.projectModels;
  const { date, shift } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);
  const day = new Date(date);
  const endOfDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);

  const [cards, entries, fleet, firstCards] = await Promise.all([
    shiftCardHours(req.projectModels, { date: day, shift }),
    EquipmentUtilization.find({ date: day, shift }).populate('vehicleId', 'name category'),
    Vehicle.find({ active: true }, { name: 1, category: 1, createdAt: 1 }),
    ShiftLog.aggregate([{ $group: { _id: '$vehicleId', first: { $min: '$date' } } }]),
  ]);
  const firstCardOf = new Map(firstCards.map((f) => [String(f._id), f.first]));

  const rows = new Map();
  fleet.forEach((v) => {
    const first = firstCardOf.get(String(v._id));
    const since = first && first < v.createdAt ? first : v.createdAt;
    if (since < endOfDay) rows.set(String(v._id), { vehicle: { _id: v._id, name: v.name, category: v.category }, operators: [], shiftCardHrs: null, ran: false, entry: null });
  });
  cards.forEach((c) => rows.set(String(c.vehicle._id), { vehicle: c.vehicle, operators: c.operators, shiftCardHrs: c.hours, ran: true, entry: null }));
  let wholeShift = null;
  entries.forEach((e) => {
    if (!e.vehicleId) {
      wholeShift = { entry: e, ...computed(e, null) };
      return;
    }
    const key = String(e.vehicleId._id);
    const row = rows.get(key) || { vehicle: e.vehicleId, operators: [], shiftCardHrs: null, ran: false };
    rows.set(key, { ...row, entry: e });
  });

  const vehicles = [...rows.values()]
    .map((r) => ({ ...r, ...computed(r.entry, r.shiftCardHrs, r.ran) }))
    .sort((a, b) => a.vehicle.name.localeCompare(b.vehicle.name, undefined, { numeric: true }));

  res.status(200).json({ success: true, data: { shiftHours: SHIFT_HOURS, wholeShift, vehicles } });
});

// Upsert on (date, shift, vehicle); no vehicle means the whole shift.
const upsertUtilization = asyncHandler(async (req, res) => {
  const { EquipmentUtilization, Vehicle } = req.projectModels;
  const { date, shift, remark } = req.body;
  const vehicleId = req.body.vehicleId || null;
  if (!date || !shift) throw new AppError('date and shift are required', 400);
  if (vehicleId) {
    if (!mongoose.isValidObjectId(vehicleId) || !(await Vehicle.exists({ _id: vehicleId }))) {
      throw new AppError('Vehicle not found', 404);
    }
  }

  const setFields = { date: new Date(date), shift, vehicleId, remark: remark || '', createdBy: req.user._id };
  HOUR_KEYS.forEach((key) => {
    const value = toNumberOrNull(req.body[key]);
    if (value != null && (value < 0 || value > 24)) throw new AppError('Hours must be between 0 and 24', 400);
    setFields[key] = value;
  });
  if (!vehicleId && !setFields.idleHrs && !setFields.remark) {
    throw new AppError('Enter the idle hours or a reason for the whole shift', 400);
  }

  const entry = await EquipmentUtilization.findOneAndUpdate(
    { date: setFields.date, shift, vehicleId },
    { $set: setFields },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await entry.populate('vehicleId', 'name category');
  res.status(200).json({ success: true, data: entry });
});

const deleteUtilization = asyncHandler(async (req, res) => {
  const { EquipmentUtilization } = req.projectModels;
  const entry = await EquipmentUtilization.findByIdAndDelete(req.params.entryId);
  if (!entry) throw new AppError('Entry not found', 404);
  res.status(200).json({ success: true, data: { _id: req.params.entryId } });
});

module.exports = { listUtilization, upsertUtilization, deleteUtilization, shiftCardHours, computed, SHIFT_HOURS };
