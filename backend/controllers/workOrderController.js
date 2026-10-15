const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const RATE_KEYS = ['ratePerCubicMetre', 'drillerWage', 'helperWage', 'wageMarkupPct'];

// Copies the editable fields present in the request onto the work order.
async function apply(models, workOrder, body) {
  if (body.number !== undefined) workOrder.number = String(body.number).trim();
  if (body.description !== undefined) workOrder.description = body.description;
  if (body.active !== undefined) workOrder.active = body.active;
  RATE_KEYS.forEach((key) => {
    if (body[key] === undefined || body[key] === '') return;
    const value = Number(body[key]);
    const minimum = key === 'wageMarkupPct' ? 0 : Number.MIN_VALUE;
    if (!Number.isFinite(value) || value < minimum) {
      throw new AppError(`${key} must be a number${key === 'wageMarkupPct' ? '' : ' greater than 0'}`, 400);
    }
    workOrder[key] = value;
  });
  if (body.levelIds !== undefined) {
    const ids = [...new Set((Array.isArray(body.levelIds) ? body.levelIds : []).map(String))];
    if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new AppError('levelIds must be level ids', 400);
    const found = await models.Level.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length) throw new AppError('One or more levels were not found', 400);
    workOrder.levelIds = ids;
  }
}

const populateLevels = { path: 'levelIds', select: 'name tonsPerTub tonsPerCubicMetre' };

const listWorkOrders = asyncHandler(async (req, res) => {
  const { WorkOrder } = req.projectModels;
  const filter = {};
  if (req.query.active !== undefined) filter.active = req.query.active === 'true';
  const workOrders = await WorkOrder.find(filter).populate(populateLevels).sort({ number: 1 });
  res.status(200).json({ success: true, data: workOrders });
});

const createWorkOrder = asyncHandler(async (req, res) => {
  const { WorkOrder } = req.projectModels;
  if (!req.body.number || !String(req.body.number).trim()) throw new AppError('number is required', 400);

  const workOrder = new WorkOrder();
  await apply(req.projectModels, workOrder, req.body);
  await workOrder.save();
  await workOrder.populate(populateLevels);
  res.status(201).json({ success: true, data: workOrder });
});

const updateWorkOrder = asyncHandler(async (req, res) => {
  const { WorkOrder } = req.projectModels;
  const workOrder = await WorkOrder.findById(req.params.id);
  if (!workOrder) throw new AppError('Work order not found', 404);

  await apply(req.projectModels, workOrder, req.body);
  await workOrder.save();
  await workOrder.populate(populateLevels);
  res.status(200).json({ success: true, data: workOrder });
});

module.exports = { listWorkOrders, createWorkOrder, updateWorkOrder };
