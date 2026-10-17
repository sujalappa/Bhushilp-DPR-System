const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getShiftTripsByHandling } = require('../utils/tripCount');
const { OB_PER_TRIP } = require('../utils/obFactors');
const { round } = require('../utils/numbers');

// Everything except Hard OB and Target is derived, never stored, so it can't
// drift from its inputs. OB Rehandling and Soft OB both come from the
// Shift Card: each entry there is marked as one or the other, and its trips
// count towards that column at the per-trip figure in utils/obFactors.
// `trips` is { 'ob-rehandling': n, 'soft-ob': n } for the date and shift.
function withComputed(doc, trips) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const hardOB = obj.hardOB || 0;
  const obRehandling = (trips['ob-rehandling'] || 0) * OB_PER_TRIP['ob-rehandling'];
  const softOB = (trips['soft-ob'] || 0) * OB_PER_TRIP['soft-ob'];
  const totalCum = round(hardOB + softOB + obRehandling);
  const achievementPct = obj.target ? Number(((totalCum / obj.target) * 100).toFixed(1)) : null;
  return {
    ...obj,
    softOB,
    obRehandling,
    rehandlingTrips: trips['ob-rehandling'] || 0,
    softObTrips: trips['soft-ob'] || 0,
    totalCum,
    achievementPct,
  };
}

const getDailyProduction = asyncHandler(async (req, res) => {
  const { DailyProduction } = req.projectModels;
  const { date, shift } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);

  const [doc, trips] = await Promise.all([
    DailyProduction.findOne({ date: new Date(date), shift }),
    getShiftTripsByHandling(req.projectModels, new Date(date), shift),
  ]);
  res.status(200).json({
    success: true,
    data: withComputed(doc || { date, shift, hardOB: 0, target: null, remark: '' }, trips),
  });
});

const upsertDailyProduction = asyncHandler(async (req, res) => {
  const { DailyProduction } = req.projectModels;
  const { date, shift, hardOB, target, remark } = req.body;
  if (!date || !shift) throw new AppError('date and shift are required', 400);

  const setFields = {
    date: new Date(date),
    shift,
    hardOB: hardOB === '' || hardOB == null ? 0 : Number(hardOB),
    target: target === '' || target == null ? undefined : Number(target),
    remark,
    createdBy: req.user._id,
  };

  const [doc, trips] = await Promise.all([
    DailyProduction.findOneAndUpdate(
      { date: new Date(date), shift },
      { $set: setFields },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    getShiftTripsByHandling(req.projectModels, new Date(date), shift),
  ]);

  res.status(200).json({ success: true, data: withComputed(doc, trips) });
});

module.exports = { getDailyProduction, upsertDailyProduction, withComputed };
