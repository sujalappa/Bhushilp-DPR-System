const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

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

// Anyone on the project can add a level by name while filling a form. It
// starts on the default factors; changing them goes through `update`,
// which is superadmin-only.
const create = asyncHandler(async (req, res) => {
  const { Level } = req.projectModels;
  const { name } = req.body;
  if (!name) throw new AppError('name is required', 400);

  const level = await Level.create({ name });
  res.status(201).json({ success: true, data: level });
});

const update = asyncHandler(async (req, res) => {
  const { Level } = req.projectModels;
  const level = await Level.findById(req.params.id);
  if (!level) throw new AppError('Level not found', 404);

  const { name, active } = req.body;
  if (name !== undefined) level.name = name;
  if (active !== undefined) level.active = active;
  applyFactors(level, req.body);
  await level.save();

  res.status(200).json({ success: true, data: level });
});

module.exports = { list, create, update };
