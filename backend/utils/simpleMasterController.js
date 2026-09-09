const AppError = require('./AppError');
const asyncHandler = require('./asyncHandler');

// Driver and LoadingPoint are both just { name, active } masters scoped to
// req.projectModels — this factory avoids writing the same three handlers
// twice. Vehicle has extra fields (regNo, category) so it stays its own
// controller.
function createSimpleMasterController(modelKey) {
  const list = asyncHandler(async (req, res) => {
    const Model = req.projectModels[modelKey];
    const filter = {};
    if (req.query.active !== undefined) filter.active = req.query.active === 'true';
    const docs = await Model.find(filter).sort({ name: 1 });
    res.status(200).json({ success: true, data: docs });
  });

  const create = asyncHandler(async (req, res) => {
    const Model = req.projectModels[modelKey];
    const { name } = req.body;
    if (!name) throw new AppError('name is required', 400);
    const doc = await Model.create({ name });
    res.status(201).json({ success: true, data: doc });
  });

  const update = asyncHandler(async (req, res) => {
    const Model = req.projectModels[modelKey];
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new AppError(`${modelKey} not found`, 404);

    const { name, active } = req.body;
    if (name !== undefined) doc.name = name;
    if (active !== undefined) doc.active = active;
    await doc.save();

    res.status(200).json({ success: true, data: doc });
  });

  return { list, create, update };
}

module.exports = createSimpleMasterController;
