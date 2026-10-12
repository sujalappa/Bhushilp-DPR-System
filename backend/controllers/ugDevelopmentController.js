const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toNumberOrNull, round } = require('../utils/numbers');
const { crewFromBody, crewPopulate } = require('../utils/crew');

const NUMERIC_KEYS = ['supervisors', 'drillers', 'helpers', 'blasters', 'muckers', 'tons', 'filling', 'progress'];

const populateHeading = [{ path: 'headingId', populate: { path: 'levelId', select: 'name' } }, ...crewPopulate];

const listUgDevelopment = asyncHandler(async (req, res) => {
  const { UgDevelopment, Heading } = req.projectModels;
  const { date, shift } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);

  const day = new Date(date);
  const [entries, driven, headings] = await Promise.all([
    UgDevelopment.find({ date: day, shift }).populate(populateHeading).sort({ createdAt: 1 }),
    UgDevelopment.aggregate([
      { $match: { date: { $lte: day } } },
      { $group: { _id: '$headingId', progress: { $sum: '$progress' } } },
    ]),
    Heading.find({}, { openingProgress: 1 }),
  ]);

  // Metres driven on each heading up to and including the selected date:
  // what was already there when entries began, plus everything logged
  // since. Unlike production totals this never restarts with the month.
  const drivenById = new Map(driven.map((d) => [d._id.toString(), d.progress || 0]));
  const progressToDate = headings.map((h) => ({
    headingId: h._id,
    metres: round((h.openingProgress || 0) + (drivenById.get(h._id.toString()) || 0)),
  }));

  res.status(200).json({ success: true, data: { entries, progressToDate } });
});

// Upsert on (date, shift, heading).
const upsertUgDevelopment = asyncHandler(async (req, res) => {
  const { UgDevelopment, Heading } = req.projectModels;
  const { date, shift, headingId, remark } = req.body;
  if (!date || !shift || !headingId) throw new AppError('date, shift and headingId are required', 400);

  const heading = await Heading.findById(headingId);
  if (!heading) throw new AppError('Heading not found', 404);

  const setFields = {
    date: new Date(date),
    shift,
    headingId,
    remark: remark || '',
    createdBy: req.user._id,
    ...crewFromBody(req.body),
  };
  NUMERIC_KEYS.forEach((key) => {
    setFields[key] = toNumberOrNull(req.body[key]);
  });

  const entry = await UgDevelopment.findOneAndUpdate(
    { date: new Date(date), shift, headingId },
    { $set: setFields },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await entry.populate(populateHeading);

  res.status(200).json({ success: true, data: entry });
});

const deleteUgDevelopment = asyncHandler(async (req, res) => {
  const { UgDevelopment } = req.projectModels;
  const entry = await UgDevelopment.findByIdAndDelete(req.params.entryId);
  if (!entry) throw new AppError('Entry not found', 404);

  res.status(200).json({ success: true, data: { _id: req.params.entryId } });
});

module.exports = { listUgDevelopment, upsertUgDevelopment, deleteUgDevelopment };
