const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Not a simpleMasterController: a heading belongs to a level and carries
// its kind and opening metres on top of name/active.
const listHeadings = asyncHandler(async (req, res) => {
  const { Heading } = req.projectModels;
  const filter = {};
  if (req.query.active !== undefined) filter.active = req.query.active === 'true';

  const headings = await Heading.find(filter).populate('levelId', 'name').sort({ createdAt: 1 });
  res.status(200).json({ success: true, data: headings });
});

const createHeading = asyncHandler(async (req, res) => {
  const { Heading, Level } = req.projectModels;
  const { levelId, name, kind, openingProgress } = req.body;
  if (!levelId || !name) throw new AppError('levelId and name are required', 400);

  const level = await Level.findById(levelId);
  if (!level) throw new AppError('Level not found', 404);
  // One heading per name on a level, so the same work isn't added twice.
  const onLevel = await Heading.find({ levelId }, { name: 1 });
  if (onLevel.some((h) => h.name.trim().toLowerCase() === String(name).trim().toLowerCase())) {
    throw new AppError(`${level.name} · ${String(name).trim()} already exists — pick it from the list`, 409);
  }

  const heading = await Heading.create({
    levelId,
    name,
    kind,
    openingProgress: openingProgress === '' || openingProgress == null ? 0 : Number(openingProgress),
  });
  await heading.populate('levelId', 'name');
  res.status(201).json({ success: true, data: heading });
});

const updateHeading = asyncHandler(async (req, res) => {
  const { Heading } = req.projectModels;
  const heading = await Heading.findById(req.params.id);
  if (!heading) throw new AppError('Heading not found', 404);

  const { name, kind, openingProgress, active } = req.body;
  if (name !== undefined) heading.name = name;
  if (kind !== undefined) heading.kind = kind;
  if (openingProgress !== undefined) heading.openingProgress = Number(openingProgress);
  if (active !== undefined) heading.active = active;
  await heading.save();
  await heading.populate('levelId', 'name');

  res.status(200).json({ success: true, data: heading });
});

module.exports = { listHeadings, createHeading, updateHeading };
