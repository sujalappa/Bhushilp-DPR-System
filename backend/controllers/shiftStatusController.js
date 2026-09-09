const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const getShiftStatus = asyncHandler(async (req, res) => {
  const { ShiftStatus } = req.projectModels;
  const { date, shift } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);

  const doc = await ShiftStatus.findOne({ date: new Date(date), shift });
  // No record yet defaults to "working" — most shifts never need a status
  // record at all, only the exceptional non-working ones get saved.
  res.status(200).json({ success: true, data: doc || { date, shift, status: 'working' } });
});

const setShiftStatus = asyncHandler(async (req, res) => {
  const { ShiftStatus } = req.projectModels;
  const { date, shift, status, remark } = req.body;

  if (!date || !shift || !status) {
    throw new AppError('date, shift and status are required', 400);
  }
  if (!['working', 'non-working'].includes(status)) {
    throw new AppError('status must be "working" or "non-working"', 400);
  }
  if (status === 'non-working' && !remark) {
    throw new AppError('A remark is required when marking a shift non-working', 400);
  }

  const doc = await ShiftStatus.findOneAndUpdate(
    { date: new Date(date), shift },
    { $set: { status, remark } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({ success: true, data: doc });
});

module.exports = { getShiftStatus, setShiftStatus };
