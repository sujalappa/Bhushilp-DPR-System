const ExcelJS = require('exceljs');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { withComputed } = require('./dailyProductionController');
const { withComputed: withFuelComputed } = require('./fuelController');
const { withComputed: withUgProductionComputed, LEVEL_FIELDS } = require('./ugProductionController');
const { getShiftTripsByHandling } = require('../utils/tripCount');
const { shiftCardHours, computed: withUtilizationComputed } = require('./utilizationController');

const HANDLING_LABELS = { 'ob-rehandling': 'OB Rehandling', 'soft-ob': 'Soft OB' };
const { crewPopulate, crewNames } = require('../utils/crew');
const { round } = require('../utils/numbers');

const toDateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Stored as "HH:mm" 24-hour; shown as "2:30 PM" to match how it was entered.
function toTime12h(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

function buildDateFilter(query) {
  const { from, to } = query;
  if (!from && !to) return {};
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) filter.$lte = new Date(to);
  return { date: filter };
}

// One function per exportable dataset, shared by the on-page preview (JSON)
// and the Excel download, so the two never drift apart. Every row is
// already resolved to human-readable names (not raw ObjectIds) — this is
// meant to be read directly by a person, in the browser or in Excel.

async function fetchTripRows(models, query) {
  const trips = await models.Trip.find(buildDateFilter(query))
    .populate('vehicleId', 'name')
    .populate('driverId', 'name')
    .populate('machineVehicleId', 'name')
    .populate('loadingPointId', 'name')
    .sort({ date: 1, shift: 1, vehicleId: 1, snNo: 1 });

  const columns = ['Date', 'Shift', 'Vehicle', 'Driver', 'Trip No', 'Loading Time', 'Unloading Time', 'Machine No', 'Loading Point', 'Remarks'];
  const rows = trips.map((t) => ({
    Date: toDateOnly(t.date),
    Shift: t.shift,
    Vehicle: t.vehicleId?.name || '',
    Driver: t.driverId?.name || 'No driver assigned',
    'Trip No': t.snNo,
    'Loading Time': toTime12h(t.loadingTime),
    'Unloading Time': toTime12h(t.unloadingTime),
    'Machine No': t.machineVehicleId?.name || '',
    'Loading Point': t.loadingPointId?.name || '',
    Remarks: t.remarks || '',
  }));
  return { columns, rows };
}

async function fetchShiftLogRows(models, query) {
  const logs = await models.ShiftLog.find(buildDateFilter(query))
    .populate('vehicleId', 'name')
    .populate('driverId', 'name')
    .sort({ date: 1, shift: 1, vehicleId: 1 });

  const columns = [
    'Date', 'Shift', 'Vehicle', 'Driver', 'Status',
    'Starting KM', 'Closing KM', 'Total KM',
    'Starting Hrs', 'Closing Hrs', 'Total Hrs',
    'Fuel Issued', 'Fuel Issued KM', 'Total Trips', 'Handling', 'Remark',
  ];
  const rows = logs.map((l) => ({
    Date: toDateOnly(l.date),
    Shift: l.shift,
    Vehicle: l.vehicleId?.name || '',
    Driver: l.driverId?.name || 'No driver assigned',
    Status: l.status,
    'Starting KM': l.startKm ?? '',
    'Closing KM': l.closeKm ?? '',
    // Two decimals, like a meter: 229.7 − 228.3 is 1.3999999999999773 otherwise.
    'Total KM': l.startKm != null && l.closeKm != null ? round(l.closeKm - l.startKm, 2) : '',
    'Starting Hrs': l.startHrs ?? '',
    'Closing Hrs': l.closeHrs ?? '',
    'Total Hrs': l.startHrs != null && l.closeHrs != null ? round(l.closeHrs - l.startHrs, 2) : '',
    'Fuel Issued': l.fuelOpen ?? '',
    'Fuel Issued KM': l.fuelClose ?? '',
    'Total Trips': l.totalTripsManual ?? '',
    Handling: l.status === 'working' ? HANDLING_LABELS[l.handlingType] : '',
    Remark: l.remark || '',
  }));
  return { columns, rows };
}

async function fetchShiftStatusRows(models, query) {
  const statuses = await models.ShiftStatus.find(buildDateFilter(query)).sort({ date: 1, shift: 1 });

  const columns = ['Date', 'Shift', 'Status', 'Remark'];
  const rows = statuses.map((s) => ({
    Date: toDateOnly(s.date),
    Shift: s.shift,
    Status: s.status,
    Remark: s.remark || '',
  }));
  return { columns, rows };
}

async function fetchProductionRows(models, query) {
  const entries = await models.DailyProduction.find(buildDateFilter(query)).sort({ date: 1, shift: 1 });

  const columns = ['Date', 'Shift', 'Hard OB', 'Soft OB', 'OB Rehandling', 'Total Cum', 'Target', 'Achievement %', 'Remarks'];
  const rows = await Promise.all(entries.map(async (e) => {
    const trips = await getShiftTripsByHandling(models, e.date, e.shift);
    const c = withComputed(e, trips);
    return {
      Date: toDateOnly(c.date),
      Shift: c.shift,
      'Hard OB': c.hardOB ?? '',
      'Soft OB': c.softOB ?? '',
      'OB Rehandling': c.obRehandling ?? '',
      'Total Cum': c.totalCum,
      Target: c.target ?? '',
      'Achievement %': c.achievementPct ?? '',
      Remarks: c.remark || '',
    };
  }));
  return { columns, rows };
}

async function fetchFuelRows(models, query) {
  const logs = await models.FuelLog.find(buildDateFilter(query))
    .populate('vehicleId', 'name')
    .sort({ date: 1, vehicleId: 1 });

  const columns = ['Date', 'Vehicle', 'Opening KM', 'Closing KM', 'Opening Fuel', 'Fuel Issued', 'Closing Fuel', 'Diesel Consumed', 'Fuel/KM', 'Remarks'];
  const rows = logs.map((l) => {
    const c = withFuelComputed(l);
    return {
      Date: toDateOnly(c.date),
      Vehicle: c.vehicleId?.name || '',
      'Opening KM': c.openingKm ?? '',
      'Closing KM': c.closingKm ?? '',
      'Opening Fuel': c.openingFuel ?? '',
      'Fuel Issued': c.fuelIssued ?? '',
      'Closing Fuel': c.closingFuel ?? '',
      'Diesel Consumed': c.dieselConsumed ?? '',
      'Fuel/KM': c.fuelPerKm ?? '',
      Remarks: c.remark || '',
    };
  });
  return { columns, rows };
}

// Saved utilization entries; working hours nobody set come from the
// vehicle's Shift Card, as on the form.
async function fetchUtilizationRows(models, query) {
  const filter = buildDateFilter(query);
  const [entries, cards] = await Promise.all([
    models.EquipmentUtilization.find(filter).populate('vehicleId', 'name').sort({ date: 1, shift: 1 }),
    shiftCardHours(models, filter),
  ]);

  const columns = ['Date', 'Shift', 'Equipment', 'Operator', 'Available Hrs', 'Working Hrs', 'Idle Hrs', 'Breakdown Hrs', 'Utilization %', 'Remarks'];
  const rows = entries.map((e) => {
    const card = e.vehicleId ? cards.get(`${e.date.toISOString()}|${e.shift}|${e.vehicleId._id}`) : null;
    // No Shift Card: the vehicle didn't run, so 0 working hours unless set.
    const c = withUtilizationComputed(e, card?.hours, !e.vehicleId || Boolean(card));
    return {
      Date: toDateOnly(e.date),
      Shift: e.shift,
      Equipment: e.vehicleId?.name || 'Whole shift (all equipment)',
      Operator: card?.operators.join(', ') || '',
      'Available Hrs': e.vehicleId ? c.availableHrs : '',
      'Working Hrs': c.workingHrs ?? '',
      'Idle Hrs': c.idleHrs ?? '',
      'Breakdown Hrs': c.breakdownHrs ?? '',
      'Utilization %': e.vehicleId ? c.utilizationPct ?? '' : '',
      Remarks: e.remark || '',
    };
  });
  return { columns, rows };
}

// Who did each job, as comma-separated names. Expects the crew populated.
const crewNameColumns = (entry) => ({
  'Driller Names': crewNames(entry, 'drillerIds'),
  'Helper Names': crewNames(entry, 'helperIds'),
  'Mucker Names': crewNames(entry, 'muckerIds'),
  'Blaster Names': crewNames(entry, 'blasterIds'),
});

async function fetchUgProductionRows(models, query) {
  const entries = await models.UgProduction.find(buildDateFilter(query))
    .populate('workOrderId', 'number')
    .populate('levelId', LEVEL_FIELDS)
    .populate('supervisorId', 'name')
    .populate(crewPopulate)
    .sort({ date: 1, shift: 1, createdAt: 1 });

  const columns = [
    'Date', 'Shift', 'Work Order', 'Level', 'Supervisor Name',
    'Supervisor', 'Driller', 'Helper', 'Mucker', 'Blaster', 'Driller + Helper', 'Total Manpower',
    'Tubs', 'Tons', 'M3', 'OMS',
    'Driller Names', 'Helper Names', 'Mucker Names', 'Blaster Names', 'Remark',
  ];
  const rows = entries.map((e) => {
    const c = withUgProductionComputed(e);
    return {
      Date: toDateOnly(c.date),
      Shift: c.shift,
      'Work Order': c.workOrderId?.number || '',
      Level: c.levelId?.name || '',
      'Supervisor Name': c.supervisorId?.name || '',
      Supervisor: c.supervisors ?? '',
      Driller: c.drillers ?? '',
      Helper: c.helpers ?? '',
      Mucker: c.muckers ?? '',
      Blaster: c.blasters ?? '',
      'Driller + Helper': c.drillerHelper,
      'Total Manpower': c.totalManpower,
      Tubs: c.tubs,
      Tons: c.tons,
      M3: c.cubicMetres,
      OMS: c.oms ?? '',
      ...crewNameColumns(c),
      Remark: c.remark || '',
    };
  });
  return { columns, rows };
}

async function fetchUgDevelopmentRows(models, query) {
  const entries = await models.UgDevelopment.find(buildDateFilter(query))
    .populate('workOrderId', 'number')
    .populate({ path: 'headingId', populate: { path: 'levelId', select: 'name' } })
    .populate({ path: 'supervisorIds', select: 'name' })
    .populate(crewPopulate)
    .sort({ date: 1, shift: 1, createdAt: 1 });

  const columns = [
    'Date', 'Shift', 'Work Order', 'Level', 'Heading',
    'Supervisor', 'Driller', 'Helper', 'Blaster', 'Mucker',
    'Tons', 'Filling', 'Progress (m)',
    'Supervisor Names', 'Driller Names', 'Helper Names', 'Mucker Names', 'Blaster Names', 'Remark',
  ];
  const rows = entries.map((e) => ({
    Date: toDateOnly(e.date),
    Shift: e.shift,
    'Work Order': e.workOrderId?.number || '',
    Level: e.headingId?.levelId?.name || '',
    Heading: e.headingId?.name || '',
    Supervisor: e.supervisors ?? '',
    Driller: e.drillers ?? '',
    Helper: e.helpers ?? '',
    Blaster: e.blasters ?? '',
    Mucker: e.muckers ?? '',
    Tons: e.tons ?? '',
    Filling: e.filling ?? '',
    'Progress (m)': e.progress ?? '',
    'Supervisor Names': (e.supervisorIds || []).map((s) => s?.name).filter(Boolean).join(', '),
    ...crewNameColumns(e),
    Remark: e.remark || '',
  }));
  return { columns, rows };
}

// Which datasets a project has depends on its type. `key` is what the
// preview endpoint is asked for; `sheet` is the tab name in the workbook.
const OPEN_CAST_DATASETS = [
  { key: 'trips', sheet: 'Fleet Trip Count', fetch: fetchTripRows },
  { key: 'shiftLogs', sheet: 'Vehicle Shift Log', fetch: fetchShiftLogRows },
  { key: 'shiftStatus', sheet: 'Shift Status', fetch: fetchShiftStatusRows },
  { key: 'production', sheet: 'Daily Production', fetch: fetchProductionRows },
  { key: 'fuel', sheet: 'Fuel Consumption', fetch: fetchFuelRows },
  { key: 'utilization', sheet: 'Equipment Utilization', fetch: fetchUtilizationRows },
];
const UNDERGROUND_DATASETS = [
  { key: 'ugProduction', sheet: 'Level Production', fetch: fetchUgProductionRows },
  { key: 'ugDevelopment', sheet: 'Development', fetch: fetchUgDevelopmentRows },
  { key: 'shiftStatus', sheet: 'Shift Status', fetch: fetchShiftStatusRows },
];
const datasetsFor = (project) => (project.type === 'underground' ? UNDERGROUND_DATASETS : OPEN_CAST_DATASETS);

const getPreview = asyncHandler(async (req, res) => {
  const datasets = datasetsFor(req.project);
  const dataset = datasets.find((d) => d.key === req.query.type);
  if (!dataset) throw new AppError(`type must be one of: ${datasets.map((d) => d.key).join(', ')}`, 400);

  const { columns, rows } = await dataset.fetch(req.projectModels, req.query, req.project);
  res.status(200).json({ success: true, data: { columns, rows } });
});

const downloadExcel = asyncHandler(async (req, res) => {
  const datasets = datasetsFor(req.project);
  const results = await Promise.all(datasets.map((d) => d.fetch(req.projectModels, req.query, req.project)));

  const workbook = new ExcelJS.Workbook();
  const addSheet = (name, { columns, rows }) => {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(c.length + 2, 14) }));
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(r));
  };

  datasets.forEach((d, i) => addSheet(d.sheet, results[i]));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${req.project.name.replace(/[^a-z0-9]/gi, '_')}_export.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = { getPreview, downloadExcel };
