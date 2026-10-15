// Trips for a (date, shift), split by the kind of handling each Shift Card
// entry was marked as: { 'ob-rehandling': n, 'soft-ob': n }. Each entry
// counts its ShiftLog.totalTripsManual — the number the supervisor wrote on
// the card. Individual Trip documents are detail records only and are never
// counted. Entries saved before the handling type existed count as OB
// Rehandling (the schema default), which is what they were.
const { HANDLING_TYPES } = require('./obFactors');

async function getShiftTripsByHandling(models, date, shift) {
  const { ShiftLog } = models;
  const logs = await ShiftLog.find({ date, shift, status: 'working' }, { totalTripsManual: 1, handlingType: 1 });
  const trips = Object.fromEntries(HANDLING_TYPES.map((t) => [t, 0]));
  logs.forEach((l) => {
    trips[l.handlingType] = (trips[l.handlingType] || 0) + (l.totalTripsManual || 0);
  });
  return trips;
}

module.exports = { getShiftTripsByHandling };
