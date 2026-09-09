const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Total Cum and Achievement % were always just arithmetic on the other
// columns in the real spreadsheet (Total Cum literally equalled OB
// Rehandling in every historical row, since Hard/Soft OB were never
// filled) — computed on read here instead of stored, so they can never
// drift out of sync with the inputs they're derived from.
function withComputed(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const hardOB = obj.hardOB || 0;
  const softOB = obj.softOB || 0;
  const obRehandling = obj.obRehandling || 0;
  const totalCum = hardOB + softOB + obRehandling;
  const achievementPct = obj.target ? Number(((totalCum / obj.target) * 100).toFixed(1)) : null;
  return { ...obj, totalCum, achievementPct };
}

const getDailyProduction = asyncHandler(async (req, res) => {
  const { DailyProduction } = req.projectModels;
  const { date, shift } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);

  const doc = await DailyProduction.findOne({ date: new Date(date), shift });
  res.status(200).json({
    success: true,
    data: doc ? withComputed(doc) : withComputed({ date, shift, hardOB: null, softOB: null, obRehandling: null, target: null, remark: '' }),
  });
});

const upsertDailyProduction = asyncHandler(async (req, res) => {
  const { DailyProduction } = req.projectModels;
  const { date, shift, hardOB, softOB, obRehandling, target, remark } = req.body;
  if (!date || !shift) throw new AppError('date and shift are required', 400);

  const setFields = {
    date: new Date(date),
    shift,
    hardOB: hardOB === '' || hardOB == null ? undefined : Number(hardOB),
    softOB: softOB === '' || softOB == null ? undefined : Number(softOB),
    obRehandling: obRehandling === '' || obRehandling == null ? undefined : Number(obRehandling),
    target: target === '' || target == null ? undefined : Number(target),
    remark,
    createdBy: req.user._id,
  };

  const doc = await DailyProduction.findOneAndUpdate(
    { date: new Date(date), shift },
    { $set: setFields },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({ success: true, data: withComputed(doc) });
});

module.exports = { getDailyProduction, upsertDailyProduction, withComputed };
