const ExcelJS = require('exceljs');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { withComputed } = require('./dailyProductionController');
const { withComputed: withFuelComputed } = require('./fuelController');

const toDateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

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
    'Loading Time': t.loadingTime || '',
    'Unloading Time': t.unloadingTime || '',
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
    'Fuel Open', 'Fuel Close', 'Remark',
  ];
  const rows = logs.map((l) => ({
    Date: toDateOnly(l.date),
    Shift: l.shift,
    Vehicle: l.vehicleId?.name || '',
    Driver: l.driverId?.name || 'No driver assigned',
    Status: l.status,
    'Starting KM': l.startKm ?? '',
    'Closing KM': l.closeKm ?? '',
    'Total KM': l.startKm != null && l.closeKm != null ? l.closeKm - l.startKm : '',
    'Starting Hrs': l.startHrs ?? '',
    'Closing Hrs': l.closeHrs ?? '',
    'Total Hrs': l.startHrs != null && l.closeHrs != null ? l.closeHrs - l.startHrs : '',
    'Fuel Open': l.fuelOpen ?? '',
    'Fuel Close': l.fuelClose ?? '',
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
  const rows = entries.map((e) => {
    const c = withComputed(e);
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
  });
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

const FETCHERS = {
  trips: fetchTripRows,
  shiftLogs: fetchShiftLogRows,
  shiftStatus: fetchShiftStatusRows,
  production: fetchProductionRows,
  fuel: fetchFuelRows,
};

const getPreview = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const fetcher = FETCHERS[type];
  if (!fetcher) throw new AppError('type must be one of: trips, shiftLogs, shiftStatus, production, fuel', 400);

  const { columns, rows } = await fetcher(req.projectModels, req.query);
  res.status(200).json({ success: true, data: { columns, rows } });
});

const downloadExcel = asyncHandler(async (req, res) => {
  const [trips, shiftLogs, shiftStatus, production, fuel] = await Promise.all([
    fetchTripRows(req.projectModels, req.query),
    fetchShiftLogRows(req.projectModels, req.query),
    fetchShiftStatusRows(req.projectModels, req.query),
    fetchProductionRows(req.projectModels, req.query),
    fetchFuelRows(req.projectModels, req.query),
  ]);

  const workbook = new ExcelJS.Workbook();
  const addSheet = (name, { columns, rows }) => {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(c.length + 2, 14) }));
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => sheet.addRow(r));
  };

  addSheet('Fleet Trip Count', trips);
  addSheet('Vehicle Shift Log', shiftLogs);
  addSheet('Shift Status', shiftStatus);
  addSheet('Daily Production', production);
  addSheet('Fuel Consumption', fuel);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${req.project.name.replace(/[^a-z0-9]/gi, '_')}_export.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = { getPreview, downloadExcel };
