const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { normalizeLevelName } = require('../utils/levelName');

const FACTOR_KEYS = ['tonsPerTub', 'tonsPerCubicMetre'];

// Not a simpleMasterController: a level also carries its two conversion
// factors, which the superadmin edits from the Level Production form.
const list = asyncHandler(async (req, res) => {
  const { Level } = req.projectModels;
  const filter = {};
  if (req.query.active !== undefined) filter.active = req.query.active === 'true';

  const levels = await Level.find(filter).sort({ name: 1 });
  res.status(200).json({ success: true, data: levels });
});

// Copies any conversion factors present in the request onto the level.
function applyFactors(level, body) {
  FACTOR_KEYS.forEach((key) => {
    if (body[key] === undefined) return;
    const value = Number(body[key]);
    if (!Number.isFinite(value) || value <= 0) {
      throw new AppError(`${key} must be a number greater than 0`, 400);
    }
    level[key] = value;
  });
}

// The name in house style ("-370'L"), refused if another level already has
// it — compared in house style too, so "-370L" saved before this matches.
async function checkedName(Level, rawName, exceptId) {
  const name = normalizeLevelName(rawName);
  if (!name) throw new AppError('name is required', 400);
  const others = await Level.find(exceptId ? { _id: { $ne: exceptId } } : {}, { name: 1 });
  const clash = others.find((l) => normalizeLevelName(l.name).toLowerCase() === name.toLowerCase());
  if (clash) throw new AppError(`${clash.name} already exists — tick it instead`, 409);
  return name;
}

// The superadmin adds levels from the work order form. A level starts on
// the default factors; changing them goes through `update`.
const create = asyncHandler(async (req, res) => {
  const { Level } = req.projectModels;
  const level = await Level.create({ name: await checkedName(Level, req.body.name) });
  res.status(201).json({ success: true, data: level });
});

const update = asyncHandler(async (req, res) => {
  const { Level } = req.projectModels;
  const level = await Level.findById(req.params.id);
  if (!level) throw new AppError('Level not found', 404);

  const { name, active } = req.body;
  if (name !== undefined) level.name = await checkedName(Level, name, level._id);
  if (active !== undefined) level.active = active;
  applyFactors(level, req.body);
  await level.save();

  res.status(200).json({ success: true, data: level });
});

module.exports = { list, create, update };
