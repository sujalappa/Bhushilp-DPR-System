const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getShiftTripTotal } = require('../utils/tripCount');

// Total Cum and Achievement % are always just arithmetic on the other
// columns — computed on read here instead of stored, so they can never
// drift out of sync with the inputs they're derived from. OB Rehandling
// is itself derived too: 14 x the shift's total trips (`tripCount`, the sum
// of every working segment's ShiftLog.totalTripsManual — see
// utils/tripCount; individual Trip documents are never counted). Soft OB is
// locked at 0 in the UI until the rehandling formula moves there in future.
function withComputed(doc, tripCount) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const hardOB = obj.hardOB || 0;
  const softOB = obj.softOB || 0;
  const obRehandling = (tripCount || 0) * 14;
  const totalCum = hardOB + softOB + obRehandling;
  const achievementPct = obj.target ? Number(((totalCum / obj.target) * 100).toFixed(1)) : null;
  return { ...obj, obRehandling, totalCum, achievementPct };
}

const getDailyProduction = asyncHandler(async (req, res) => {
  const { DailyProduction } = req.projectModels;
  const { date, shift } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);

  const [doc, tripCount] = await Promise.all([
    DailyProduction.findOne({ date: new Date(date), shift }),
    getShiftTripTotal(req.projectModels, new Date(date), shift),
  ]);
  res.status(200).json({
    success: true,
    data: withComputed(doc || { date, shift, hardOB: 0, softOB: 0, target: null, remark: '' }, tripCount),
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
    softOB: 0,
    target: target === '' || target == null ? undefined : Number(target),
    remark,
    createdBy: req.user._id,
  };

  const [doc, tripCount] = await Promise.all([
    DailyProduction.findOneAndUpdate(
      { date: new Date(date), shift },
      { $set: setFields },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ),
    getShiftTripTotal(req.projectModels, new Date(date), shift),
  ]);

  res.status(200).json({ success: true, data: withComputed(doc, tripCount) });
});

module.exports = { getDailyProduction, upsertDailyProduction, withComputed };
