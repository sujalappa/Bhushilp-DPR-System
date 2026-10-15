const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { toNumberOrNull, round } = require('../utils/numbers');
const { resolveCrew, crewPopulate } = require('../utils/crew');

const COUNT_KEYS = ['supervisors', 'drillers', 'helpers', 'muckers', 'blasters'];
const LEVEL_FIELDS = 'name tonsPerTub tonsPerCubicMetre';

// Tons and m3 come from the level's own conversion factors (see the Level
// model). `level` is a Level document or its populated object.
function exactFromTubs(tubs, level) {
  const tonsPerTub = level?.tonsPerTub ?? 1.5;
  const tonsPerCubicMetre = level?.tonsPerCubicMetre ?? 3.5;
  const tons = (tubs || 0) * tonsPerTub;
  return { tons, cubicMetres: tonsPerCubicMetre > 0 ? tons / tonsPerCubicMetre : 0 };
}

function computeFromTubs(tubs, level) {
  const { tons, cubicMetres } = exactFromTubs(tubs, level);
  return { tons: round(tons), cubicMetres: round(cubicMetres) };
}

// Expects `levelId` populated with LEVEL_FIELDS. OMS is
// (Supervisor + Mucker + Blaster) / Tons, as the site defines it, and is
// blank when nothing was produced. Driller + Helper is the workbook's
// "DRILLER HELPER" column: the man-shifts the labour billing is based on.
function withComputed(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const { tons, cubicMetres } = computeFromTubs(obj.tubs, obj.levelId);
  const totalManpower = COUNT_KEYS.reduce((sum, k) => sum + (obj[k] || 0), 0);
  const oms = tons > 0 ? round(((obj.supervisors || 0) + (obj.muckers || 0) + (obj.blasters || 0)) / tons) : null;
  const drillerHelper = (obj.drillers || 0) + (obj.helpers || 0);
  return { ...obj, tons, cubicMetres, totalManpower, drillerHelper, oms };
}

// The labour and billing block from the workbook, for a set of entries
// under one work order:
//   per man-shift = wage × (1 + markup%)
//   amount        = per man-shift × driller (or helper) man-shifts
//   labour m³     = amount ÷ rate per m³        ("CUM" in the sheet)
//   total cum     = production m³ + labour m³   ("TOTAL CUM")
//   billing       = total cum × rate per m³     ("BILLING AMOUNT")
// Unrounded throughout, as the sheet's formulas are; only the results are
// rounded for display.
function labourAndBilling(entries, workOrder) {
  const rate = workOrder.ratePerCubicMetre;
  const markup = workOrder.wageMarkupPct / 100;
  const sum = (key) => entries.reduce((total, e) => total + (e[key] || 0), 0);

  const rows = [
    { category: 'Driller', wage: workOrder.drillerWage, manShifts: sum('drillers') },
    { category: 'Helper', wage: workOrder.helperWage, manShifts: sum('helpers') },
  ].map((r) => {
    const perManShift = r.wage * (1 + markup);
    const amount = perManShift * r.manShifts;
    return { ...r, markup: r.wage * markup, perManShift, amount, cubicMetres: rate > 0 ? amount / rate : 0 };
  });

  const labourCubicMetres = rows.reduce((total, r) => total + r.cubicMetres, 0);
  // From tubs again rather than each entry's displayed (rounded) m³, so
  // billing matches the sheet to the rupee.
  const productionCubicMetres = entries.reduce((total, e) => total + exactFromTubs(e.tubs, e.levelId).cubicMetres, 0);
  const totalCum = productionCubicMetres + labourCubicMetres;

  return {
    rows: rows.map((r) => ({
      category: r.category,
      wage: r.wage,
      markup: round(r.markup, 2),
      perManShift: round(r.perManShift, 2),
      manShifts: r.manShifts,
      amount: round(r.amount, 2),
      cubicMetres: round(r.cubicMetres, 2),
    })),
    ratePerCubicMetre: rate,
    wageMarkupPct: workOrder.wageMarkupPct,
    labourCubicMetres: round(labourCubicMetres, 2),
    productionCubicMetres: round(productionCubicMetres, 2),
    totalCum: round(totalCum, 2),
    billingAmount: round(totalCum * rate, 2),
  };
}

// Entries can only be made on the levels a work order covers.
function assertLevelOnWorkOrder(workOrder, level) {
  if (!workOrder.levelIds.some((id) => id.toString() === level._id.toString())) {
    throw new AppError(`Level ${level.name} isn't on work order ${workOrder.number}`, 400);
  }
}

async function findWorkOrder(models, workOrderId) {
  if (!workOrderId) throw new AppError('workOrderId is required', 400);
  const workOrder = await models.WorkOrder.findById(workOrderId).catch(() => null);
  if (!workOrder) throw new AppError('Work order not found', 404);
  return workOrder;
}

const listUgProduction = asyncHandler(async (req, res) => {
  const { UgProduction } = req.projectModels;
  const { date, shift, workOrderId } = req.query;
  if (!date || !shift) throw new AppError('date and shift are required', 400);
  const workOrder = await findWorkOrder(req.projectModels, workOrderId);

  const day = new Date(date);
  const monthStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));

  const [entries, monthEntries] = await Promise.all([
    UgProduction.find({ date: day, shift, workOrderId })
      .populate('levelId', LEVEL_FIELDS)
      .populate('supervisorId', 'name')
      .populate(crewPopulate)
      .sort({ createdAt: 1 }),
    UgProduction.find({ workOrderId, date: { $gte: monthStart, $lte: day } }).populate('levelId', LEVEL_FIELDS),
  ]);

  const month = monthEntries.map(withComputed);
  const dayEntries = month.filter((e) => e.date.getTime() === day.getTime());

  // Month to date per level, up to and including the selected date — the
  // workbook's running "CUM." columns, which restart each month.
  const byLevel = new Map();
  month.forEach((e) => {
    const key = e.levelId?._id?.toString() || 'unknown';
    const row = byLevel.get(key) || { levelId: e.levelId?._id, levelName: e.levelId?.name || '', tubs: 0, drillerHelper: 0, tons: 0, cubicMetres: 0 };
    row.tubs += e.tubs || 0;
    row.drillerHelper += e.drillerHelper;
    row.tons += e.tons;
    row.cubicMetres += e.cubicMetres;
    byLevel.set(key, row);
  });
  const monthToDate = [...byLevel.values()]
    .map((r) => ({ ...r, tons: round(r.tons), cubicMetres: round(r.cubicMetres) }))
    .sort((a, b) => a.levelName.localeCompare(b.levelName));

  res.status(200).json({
    success: true,
    data: {
      entries: entries.map(withComputed),
      monthToDate,
      // Labour and billing cover the whole day (every shift), not just the
      // shift on screen, matching the daily report. They're billing
      // figures, so only the superadmin gets them.
      labour: req.user.isSuperAdmin
        ? { day: labourAndBilling(dayEntries, workOrder), monthToDate: labourAndBilling(month, workOrder) }
        : null,
    },
  });
});

// The entry's supervisor, by id, or by name for one typed in on a phone
// that was offline at the time (matched case-insensitively, added if new).
async function findSupervisor(Supervisor, supervisorId, supervisorName) {
  if (supervisorId) return Supervisor.findById(supervisorId);
  const name = String(supervisorName).trim().replace(/\s+/g, ' ');
  const existing = await Supervisor.find({}, { name: 1 });
  return existing.find((s) => s.name.toLowerCase() === name.toLowerCase()) || Supervisor.create({ name });
}

// Upsert on (date, shift, work order, level, supervisor) — one record per gang.
const upsertUgProduction = asyncHandler(async (req, res) => {
  const { UgProduction, Level, Supervisor } = req.projectModels;
  const { date, shift, workOrderId, levelId, supervisorName, tubs, remark } = req.body;

  if (!date || !shift || !levelId || !(req.body.supervisorId || supervisorName?.trim())) {
    throw new AppError('date, shift, levelId and supervisorId (or supervisorName) are required', 400);
  }
  if (tubs === '' || tubs == null) throw new AppError('Tubs is required', 400);
  const workOrder = await findWorkOrder(req.projectModels, workOrderId);

  const level = await Level.findById(levelId);
  if (!level) throw new AppError('Level not found', 404);
  assertLevelOnWorkOrder(workOrder, level);
  const supervisor = await findSupervisor(Supervisor, req.body.supervisorId, supervisorName);
  if (!supervisor) throw new AppError('Supervisor not found', 404);
  const supervisorId = supervisor._id;

  const setFields = {
    date: new Date(date),
    shift,
    workOrderId,
    levelId,
    supervisorId,
    tubs: Number(tubs),
    remark: remark || '',
    createdBy: req.user._id,
    ...(await resolveCrew(req.projectModels, req.body)),
  };
  COUNT_KEYS.forEach((key) => {
    setFields[key] = toNumberOrNull(req.body[key]);
  });

  const entry = await UgProduction.findOneAndUpdate(
    { date: new Date(date), shift, workOrderId, levelId, supervisorId },
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

module.exports = {
  listUgProduction,
  upsertUgProduction,
  deleteUgProduction,
  withComputed,
  findWorkOrder,
  assertLevelOnWorkOrder,
  LEVEL_FIELDS,
};
