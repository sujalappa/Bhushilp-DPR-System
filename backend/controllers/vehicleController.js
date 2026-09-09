const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Not a simpleMasterController: Vehicle has regNo/category on top of
// name/active, and category is what lets the trip form filter the
// "Machine no." dropdown to loading equipment only.
const listVehicles = asyncHandler(async (req, res) => {
  const { Vehicle } = req.projectModels;
  const filter = {};
  if (req.query.active !== undefined) filter.active = req.query.active === 'true';
  if (req.query.category) filter.category = req.query.category;

  const vehicles = await Vehicle.find(filter).sort({ name: 1 });
  res.status(200).json({ success: true, data: vehicles });
});

const createVehicle = asyncHandler(async (req, res) => {
  const { Vehicle } = req.projectModels;
  const { name, regNo, category } = req.body;
  if (!name) throw new AppError('name is required', 400);

  const vehicle = await Vehicle.create({ name, regNo, category });
  res.status(201).json({ success: true, data: vehicle });
});

const updateVehicle = asyncHandler(async (req, res) => {
  const { Vehicle } = req.projectModels;
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) throw new AppError('Vehicle not found', 404);

  const { name, regNo, category, active } = req.body;
  if (name !== undefined) vehicle.name = name;
  if (regNo !== undefined) vehicle.regNo = regNo;
  if (category !== undefined) vehicle.category = category;
  if (active !== undefined) vehicle.active = active;
  await vehicle.save();

  res.status(200).json({ success: true, data: vehicle });
});

module.exports = { listVehicles, createVehicle, updateVehicle };
