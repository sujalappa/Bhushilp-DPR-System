const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toNumberOrNull, round } = require('../utils/numbers');
const { resolveCrew, crewPopulate } = require('../utils/crew');
const { findWorkOrder, assertLevelOnWorkOrder } = require('./ugProductionController');

const NUMERIC_KEYS = ['supervisors', 'drillers', 'helpers', 'blasters', 'muckers', 'tons', 'filling', 'progress'];

const populateHeading = [
  { path: 'headingId', populate: { path: 'levelId', select: 'name' } },
  { path: 'supervisorIds', select: 'name' },
  ...crewPopulate,
];

const tidy = (name) => String(name ?? '').trim().replace(/\s+/g, ' ');

// The typed supervisor names as Supervisor ids, from the same list Level
// Production picks from: a name matching one there (ignoring case) is that
// supervisor, a new one is added. Even with a count of 0 one name is
// allowed — whoever was in charge of the heading that shift.
async function resolveSupervisorNames(Supervisor, body) {
  const names = Array.isArray(body.supervisorNames) ? body.supervisorNames.map(tidy).filter(Boolean) : [];
  const unique = [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];
  const allowed = Math.max(1, Number(body.supervisors) || 0);
  if (unique.length > allowed) {
    throw new AppError(`${unique.length} supervisor names entered but the supervisor count is ${Number(body.supervisors) || 0}`, 400);
  }
  if (unique.length === 0) return [];

  const existing = await Supervisor.find({}, { name: 1 });
  const byName = new Map(existing.map((s) => [s.name.toLowerCase(), s._id]));
  const ids = [];
  for (const name of unique) {
    if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), (await Supervisor.create({ name }))._id);
    ids.push(byName.get(name.toLowerCase()));
  }
  return ids;
}

const listUgDevelopment = asyncHandler(async (req, res) => {
  const { UgDevelopment, Heading } = req.projectModels;
  const { date, shift, workOrderId } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);
  await findWorkOrder(req.projectModels, workOrderId);

  const day = new Date(date);
  const [entries, driven, headings] = await Promise.all([
    UgDevelopment.find({ date: day, shift, workOrderId }).populate(populateHeading).sort({ createdAt: 1 }),
    // Progress to date is the heading's physical advance, so it counts
    // every work order's metres, not just this one's.
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

// Upsert on (date, shift, work order, heading).
const upsertUgDevelopment = asyncHandler(async (req, res) => {
  const { UgDevelopment, Heading, Supervisor } = req.projectModels;
  const { date, shift, workOrderId, headingId, remark } = req.body;
  if (!date || !shift || !headingId) throw new AppError('date, shift and headingId are required', 400);
  const workOrder = await findWorkOrder(req.projectModels, workOrderId);

  const heading = await Heading.findById(headingId).populate('levelId', 'name');
  if (!heading) throw new AppError('Heading not found', 404);
  assertLevelOnWorkOrder(workOrder, heading.levelId);

  const setFields = {
    date: new Date(date),
    shift,
    workOrderId,
    headingId,
    remark: remark || '',
    createdBy: req.user._id,
    ...(await resolveCrew(req.projectModels, req.body)),
    supervisorIds: await resolveSupervisorNames(Supervisor, req.body),
  };
  NUMERIC_KEYS.forEach((key) => {
    setFields[key] = toNumberOrNull(req.body[key]);
  });

  const entry = await UgDevelopment.findOneAndUpdate(
    { date: new Date(date), shift, workOrderId, headingId },
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
