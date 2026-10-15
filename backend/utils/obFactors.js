// Cubic metres of overburden credited per trip, by the kind of handling the
// Shift Card entry was marked as (ShiftLog.handlingType).
const OB_PER_TRIP = {
  'ob-rehandling': 14,
  // Placeholder: the site hasn't confirmed the Soft OB figure yet. Change it
  // here; every Daily Production, export and Analysis figure is computed
  // from this on read, so past entries pick up the new value too.
  'soft-ob': 14,
};

const HANDLING_TYPES = Object.keys(OB_PER_TRIP);

module.exports = { OB_PER_TRIP, HANDLING_TYPES };
