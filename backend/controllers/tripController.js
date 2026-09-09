const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const listTrips = asyncHandler(async (req, res) => {
  const { Trip } = req.projectModels;
  const trips = await Trip.find({ shiftLogId: req.params.shiftLogId })
    .populate('machineVehicleId', 'name category')
    .populate('loadingPointId', 'name')
    .sort({ snNo: 1 });

  res.status(200).json({ success: true, data: trips });
});

const addTrip = asyncHandler(async (req, res) => {
  const { Trip, ShiftLog } = req.projectModels;
  const { shiftLogId } = req.params;
  const { loadingTime, unloadingTime, machineVehicleId, loadingPointId, remarks } = req.body;

  const shiftLog = await ShiftLog.findById(shiftLogId);
  if (!shiftLog) throw new AppError('Shift log not found', 404);
  if (shiftLog.status === 'non-working') {
    throw new AppError('Cannot add a trip to a vehicle marked non-working for this shift', 400);
  }

  // S.N. auto-increments per shift log — the clerk never types it, matching
  // the pre-numbered rows on the paper card.
  const lastTrip = await Trip.findOne({ shiftLogId }).sort({ snNo: -1 });
  const snNo = (lastTrip?.snNo || 0) + 1;

  const trip = await Trip.create({
    shiftLogId,
    // Copied from the parent shift-log segment at creation time — this is
    // what makes "how many trips has this driver done" (the rewards
    // leaderboard) a direct query on Trip, no join required, and it's
    // immune to a later driver change on some other segment ever
    // reattributing a trip that's already been counted.
    vehicleId: shiftLog.vehicleId,
    driverId: shiftLog.driverId,
    date: shiftLog.date,
    shift: shiftLog.shift,
    snNo,
    loadingTime,
    unloadingTime,
    machineVehicleId,
    loadingPointId,
    remarks,
  });
  // Without this, the response carries raw ObjectIds where the frontend
  // (and listTrips) expect populated {_id, name} — the newly added trip
  // would render as "No machine / No loading point" until the list reloads.
  await trip.populate('machineVehicleId', 'name category');
  await trip.populate('loadingPointId', 'name');

  res.status(201).json({ success: true, data: trip });
});

const updateTrip = asyncHandler(async (req, res) => {
  const { Trip } = req.projectModels;
  const trip = await Trip.findOne({ _id: req.params.tripId, shiftLogId: req.params.shiftLogId });
  if (!trip) throw new AppError('Trip not found', 404);

  const { loadingTime, unloadingTime, machineVehicleId, loadingPointId, remarks } = req.body;
  if (loadingTime !== undefined) trip.loadingTime = loadingTime;
  if (unloadingTime !== undefined) trip.unloadingTime = unloadingTime;
  if (machineVehicleId !== undefined) trip.machineVehicleId = machineVehicleId;
  if (loadingPointId !== undefined) trip.loadingPointId = loadingPointId;
  if (remarks !== undefined) trip.remarks = remarks;
  await trip.save();
  await trip.populate('machineVehicleId', 'name category');
  await trip.populate('loadingPointId', 'name');

  res.status(200).json({ success: true, data: trip });
});

// Hard delete is fine here (unlike vehicle/driver masters): this only
// corrects a same-day mis-entry by the clerk, not historical production data.
const deleteTrip = asyncHandler(async (req, res) => {
  const { Trip } = req.projectModels;
  const trip = await Trip.findOneAndDelete({ _id: req.params.tripId, shiftLogId: req.params.shiftLogId });
  if (!trip) throw new AppError('Trip not found', 404);

  res.status(200).json({ success: true, data: null });
});

module.exports = { listTrips, addTrip, updateTrip, deleteTrip };
