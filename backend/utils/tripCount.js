// Trip count for a (date, shift): the sum of each working driver segment's
// ShiftLog.totalTripsManual — the number the supervisor actually wrote down
// on the card. Individual Trip documents are detail records only (loading/
// unloading time, machine, loading point per trip) and are never counted
// here — every consumer that needs "how many trips happened this shift"
// (OB Rehandling, the driver rewards leaderboard) goes through this.
async function getShiftTripTotal(models, date, shift) {
  const { ShiftLog } = models;
  const logs = await ShiftLog.find({ date, shift, status: 'working' }, { totalTripsManual: 1 });
  return logs.reduce((sum, l) => sum + (l.totalTripsManual || 0), 0);
}

module.exports = { getShiftTripTotal };
