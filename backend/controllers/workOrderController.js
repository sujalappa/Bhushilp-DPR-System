const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const RATE_KEYS = ['ratePerCubicMetre', 'drillerWage', 'helperWage', 'wageMarkupPct'];

// Copies the editable fields present in the request onto the work order.
function apply(workOrder, body) {
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
}

const listWorkOrders = asyncHandler(async (req, res) => {
  const { WorkOrder } = req.projectModels;
  const filter = {};
  if (req.query.active !== undefined) filter.active = req.query.active === 'true';
  const workOrders = await WorkOrder.find(filter).sort({ number: 1 });
  res.status(200).json({ success: true, data: workOrders });
});

const createWorkOrder = asyncHandler(async (req, res) => {
  const { WorkOrder } = req.projectModels;
  if (!req.body.number || !String(req.body.number).trim()) throw new AppError('number is required', 400);

  const workOrder = new WorkOrder();
  apply(workOrder, req.body);
  await workOrder.save();
  res.status(201).json({ success: true, data: workOrder });
});

const updateWorkOrder = asyncHandler(async (req, res) => {
  const { WorkOrder } = req.projectModels;
  const workOrder = await WorkOrder.findById(req.params.id);
  if (!workOrder) throw new AppError('Work order not found', 404);

  apply(workOrder, req.body);
  await workOrder.save();
  res.status(200).json({ success: true, data: workOrder });
});

module.exports = { listWorkOrders, createWorkOrder, updateWorkOrder };
