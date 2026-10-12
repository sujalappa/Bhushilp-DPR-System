const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toNumberOrNull, round } = require('../utils/numbers');
const { crewFromBody, crewPopulate } = require('../utils/crew');

const COUNT_KEYS = ['supervisors', 'drillers', 'helpers', 'muckers', 'blasters'];
const LEVEL_FIELDS = 'name tonsPerTub tonsPerCubicMetre';

// Tons and m3 come from the level's own conversion factors (see the Level
// model). `level` is a Level document or its populated object.
function computeFromTubs(tubs, level) {
  const tonsPerTub = level?.tonsPerTub ?? 1.5;
  const tonsPerCubicMetre = level?.tonsPerCubicMetre ?? 3.5;
  const tons = (tubs || 0) * tonsPerTub;
  const cubicMetres = tonsPerCubicMetre > 0 ? tons / tonsPerCubicMetre : 0;
  return { tons: round(tons), cubicMetres: round(cubicMetres) };
}

// Expects `levelId` populated with LEVEL_FIELDS. OMS is
// (Supervisor + Mucker + Blaster) / Tons, as the site defines it, and is
// blank when nothing was produced.
function withComputed(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { tons, cubicMetres } = computeFromTubs(obj.tubs, obj.levelId);
  const totalManpower = COUNT_KEYS.reduce((sum, k) => sum + (obj[k] || 0), 0);
  const oms = tons > 0 ? round(((obj.supervisors || 0) + (obj.muckers || 0) + (obj.blasters || 0)) / tons) : null;
  return { ...obj, tons, cubicMetres, totalManpower, oms };
}

const listUgProduction = asyncHandler(async (req, res) => {
  const { UgProduction, Level } = req.projectModels;
  const { date, shift } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);

  const day = new Date(date);
  const monthStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));

  const [entries, monthTubs, levels] = await Promise.all([
    UgProduction.find({ date: day, shift })
      .populate('levelId', LEVEL_FIELDS)
      .populate('supervisorId', 'name')
      .populate(crewPopulate)
      .sort({ createdAt: 1 }),
    UgProduction.aggregate([
      { $match: { date: { $gte: monthStart, $lte: day } } },
      { $group: { _id: '$levelId', tubs: { $sum: '$tubs' } } },
    ]),
    Level.find({}, LEVEL_FIELDS),
  ]);

  // Month to date per level, up to and including the selected date — the
  // workbook's running "CUM." columns, which restart each month.
  const levelsById = new Map(levels.map((l) => [l._id.toString(), l]));
  const monthToDate = monthTubs
    .map((m) => {
      const level = levelsById.get(m._id.toString());
      return { levelId: m._id, levelName: level?.name || '', tubs: m.tubs, ...computeFromTubs(m.tubs, level) };
    })
    .sort((a, b) => a.levelName.localeCompare(b.levelName));

  res.status(200).json({ success: true, data: { entries: entries.map(withComputed), monthToDate } });
});

// Upsert on (date, shift, level, supervisor) — one record per gang.
const upsertUgProduction = asyncHandler(async (req, res) => {
  const { UgProduction, Level, Supervisor } = req.projectModels;
  const { date, shift, levelId, supervisorId, tubs, remark } = req.body;

  if (!date || !shift || !levelId || !supervisorId) {
    throw new AppError('date, shift, levelId and supervisorId are required', 400);
  }
  if (tubs === '' || tubs == null) throw new AppError('Tubs is required', 400);

  const [level, supervisor] = await Promise.all([Level.findById(levelId), Supervisor.findById(supervisorId)]);
  if (!level) throw new AppError('Level not found', 404);
  if (!supervisor) throw new AppError('Supervisor not found', 404);

  const setFields = {
    date: new Date(date),
    shift,
    levelId,
    supervisorId,
    tubs: Number(tubs),
    remark: remark || '',
    createdBy: req.user._id,
    ...crewFromBody(req.body),
  };
  COUNT_KEYS.forEach((key) => {
    setFields[key] = toNumberOrNull(req.body[key]);
  });

  const entry = await UgProduction.findOneAndUpdate(
    { date: new Date(date), shift, levelId, supervisorId },
    { $set: setFields },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await entry.populate('levelId', LEVEL_FIELDS);
  await entry.populate('supervisorId', 'name');
  await entry.populate(crewPopulate);

  res.status(200).json({ success: true, data: withComputed(entry) });
});

const deleteUgProduction = asyncHandler(async (req, res) => {
  const { UgProduction } = req.projectModels;
  const entry = await UgProduction.findByIdAndDelete(req.params.entryId);
  if (!entry) throw new AppError('Entry not found', 404);

  res.status(200).json({ success: true, data: { _id: req.params.entryId } });
});

module.exports = { listUgProduction, upsertUgProduction, deleteUgProduction, withComputed, LEVEL_FIELDS };
