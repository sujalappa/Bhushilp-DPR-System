const asyncHandler = require('../utils/asyncHandler');
const { round } = require('../utils/numbers');
const { OB_PER_TRIP } = require('../utils/obFactors');
const { withComputed: withUgProductionComputed, exactFromTubs, LEVEL_FIELDS } = require('./ugProductionController');

// One endpoint that turns a project's entries for a date range into the
// figures the Analysis page charts. It returns plain grouped totals — what
// to draw is the frontend's business. Everything is summed here in JS
// rather than in Mongo because tons depend on each level's conversion
// factors; a mine's entries for a year are a few thousand rows.

const dayOf = (date) => new Date(date).toISOString().slice(0, 10);

function dateMatch({ from, to }) {
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) range.$lte = new Date(to);
  return { date: range };
}

// Sums `value` into a nested total: add(totals, ['2026-09-01', '-370'], 19.5).
function add(target, path, value) {
  let node = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    node[path[i]] = node[path[i]] || {};
    node = node[path[i]];
  }
  const leaf = path[path.length - 1];
  node[leaf] = (node[leaf] || 0) + (value || 0);
}

const roundAll = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, round(v)]));
const byDate = (totals) =>
  Object.keys(totals)
    .sort()
    .map((date) => ({ date, ...roundAll(totals[date]) }));
const ranked = (totals, valueKey) =>
  Object.entries(totals)
    .map(([name, values]) => ({ name, ...roundAll(values) }))
    .sort((a, b) => b[valueKey] - a[valueKey]);

async function undergroundAnalysis(models, query) {
  const match = dateMatch(query);
  const [production, development] = await Promise.all([
    models.UgProduction.find(match).populate('levelId', LEVEL_FIELDS).populate('supervisorId', 'name'),
    models.UgDevelopment.find(match).populate({ path: 'headingId', populate: { path: 'levelId', select: 'name' } }),
  ]);

  const totals = { tubs: 0, tons: 0, cubicMetres: 0, manpower: 0, omsCrew: 0 };
  const tonsByDayLevel = {};
  const dayTotals = {};
  const shiftTotals = {};
  const levelTotals = {};
  const supervisorTotals = {};

  production.forEach((doc) => {
    const e = withUgProductionComputed(doc);
    const day = dayOf(e.date);
    const level = e.levelId?.name || 'Unknown level';
    const supervisor = e.supervisorId?.name || 'Unknown';
    const omsCrew = (e.supervisors || 0) + (e.muckers || 0) + (e.blasters || 0);
    // Totals add up exact figures and are rounded once at the end, so the
    // per-entry rounding (two decimals) can't accumulate.
    const { tons, cubicMetres } = exactFromTubs(e.tubs, e.levelId);

    totals.tubs += e.tubs || 0;
    totals.tons += tons;
    totals.cubicMetres += cubicMetres;
    totals.manpower += e.totalManpower;
    totals.omsCrew += omsCrew;

    add(tonsByDayLevel, [day, level], tons);
    add(dayTotals, [day, 'tons'], tons);
    add(dayTotals, [day, 'manpower'], e.totalManpower);
    add(dayTotals, [day, 'omsCrew'], omsCrew);
    add(shiftTotals, [e.shift, 'tons'], tons);
    add(shiftTotals, [e.shift, 'tubs'], e.tubs);
    add(levelTotals, [level, 'tubs'], e.tubs);
    add(levelTotals, [level, 'tons'], tons);
    add(levelTotals, [level, 'cubicMetres'], cubicMetres);
    add(supervisorTotals, [supervisor, 'tons'], tons);
    add(supervisorTotals, [supervisor, 'shifts'], 1);
  });

  let progress = 0;
  const progressByDayHeading = {};
  const headingTotals = {};
  development.forEach((e) => {
    const day = dayOf(e.date);
    const heading = `${e.headingId?.levelId?.name || 'Level'} · ${e.headingId?.name || 'Heading'}`;
    progress += e.progress || 0;
    add(progressByDayHeading, [day, heading], e.progress);
    add(headingTotals, [heading, 'progress'], e.progress);
    add(headingTotals, [heading, 'tons'], e.tons);
    add(headingTotals, [heading, 'filling'], e.filling);
  });

  // OMS as the site defines it: (Supervisor + Mucker + Blaster) / Tons.
  const oms = (crew, tons) => (tons > 0 ? round(crew / tons) : null);

  return {
    kind: 'underground',
    kpis: {
      tubs: totals.tubs,
      tons: round(totals.tons),
      cubicMetres: round(totals.cubicMetres),
      manpower: totals.manpower,
      oms: oms(totals.omsCrew, totals.tons),
      progress: round(progress),
      productionDays: Object.keys(dayTotals).length,
    },
    levels: Object.keys(levelTotals).sort(),
    tonsByDayLevel: byDate(tonsByDayLevel),
    daily: Object.keys(dayTotals)
      .sort()
      .map((date) => ({
        date,
        tons: round(dayTotals[date].tons),
        manpower: dayTotals[date].manpower,
        oms: oms(dayTotals[date].omsCrew, dayTotals[date].tons),
      })),
    byShift: ['I', 'II', 'III', 'General']
      .filter((s) => shiftTotals[s])
      .map((shift) => ({ shift, ...roundAll(shiftTotals[shift]) })),
    byLevel: ranked(levelTotals, 'tons'),
    bySupervisor: ranked(supervisorTotals, 'tons').map((s) => ({ ...s, tonsPerShift: round(s.tons / s.shifts) })),
    headings: Object.keys(headingTotals).sort(),
    progressByDayHeading: byDate(progressByDayHeading),
    byHeading: ranked(headingTotals, 'progress'),
  };
}

async function openCastAnalysis(models, query) {
  const match = dateMatch(query);
  const [logs, production, fuel] = await Promise.all([
    models.ShiftLog.find({ ...match, status: 'working' }).populate('vehicleId', 'name').populate('driverId', 'name'),
    models.DailyProduction.find(match),
    models.FuelLog.find(match).populate('vehicleId', 'name'),
  ]);

  // Daily production = Hard OB entered that day + OB Rehandling + Soft OB,
  // the last two derived from each Shift Card entry's trips by the handling
  // it was marked as — so a day with trips counts even if nobody opened the
  // Daily Production form.
  let trips = 0;
  let obRehandling = 0;
  let softOB = 0;
  const productionByDay = {};
  const tripsByDayShift = {};
  const vehicleTotals = {};
  const driverTotals = {};
  logs.forEach((l) => {
    const count = l.totalTripsManual || 0;
    const day = dayOf(l.date);
    const ob = count * OB_PER_TRIP[l.handlingType];
    trips += count;
    if (l.handlingType === 'soft-ob') softOB += ob;
    else obRehandling += ob;
    add(productionByDay, [day, 'hardOB'], 0);
    add(productionByDay, [day, 'obRehandling'], l.handlingType === 'soft-ob' ? 0 : ob);
    add(productionByDay, [day, 'softOB'], l.handlingType === 'soft-ob' ? ob : 0);
    add(tripsByDayShift, [day, l.shift], count);
    add(vehicleTotals, [l.vehicleId?.name || 'Unknown vehicle', 'trips'], count);
    add(vehicleTotals, [l.vehicleId?.name || 'Unknown vehicle', 'shifts'], 1);
    if (l.driverId) {
      add(driverTotals, [l.driverId.name, 'trips'], count);
      add(driverTotals, [l.driverId.name, 'shifts'], 1);
    }
  });

  let hardOB = 0;
  let target = 0;
  production.forEach((p) => {
    hardOB += p.hardOB || 0;
    target += p.target || 0;
    add(productionByDay, [dayOf(p.date), 'hardOB'], p.hardOB);
    add(productionByDay, [dayOf(p.date), 'obRehandling'], 0);
    add(productionByDay, [dayOf(p.date), 'softOB'], 0);
  });

  let fuelIssued = 0;
  const fuelByDay = {};
  const fuelByVehicle = {};
  fuel.forEach((f) => {
    fuelIssued += f.fuelIssued || 0;
    add(fuelByDay, [dayOf(f.date), 'litres'], f.fuelIssued);
    add(fuelByVehicle, [f.vehicleId?.name || 'Unknown vehicle', 'litres'], f.fuelIssued);
  });

  const totalCum = hardOB + obRehandling + softOB;

  return {
    kind: 'open-cast',
    kpis: {
      trips,
      obRehandling,
      softOB,
      hardOB: round(hardOB),
      totalCum: round(totalCum),
      target: round(target),
      achievementPct: target > 0 ? round((totalCum / target) * 100, 1) : null,
      fuelIssued: round(fuelIssued),
      litresPerTrip: trips > 0 && fuelIssued > 0 ? round(fuelIssued / trips, 2) : null,
      workingDays: Object.keys(tripsByDayShift).length,
    },
    shifts: ['I', 'II', 'III', 'General'].filter((s) => Object.values(tripsByDayShift).some((d) => d[s])),
    tripsByDayShift: byDate(tripsByDayShift),
    productionByDay: byDate(productionByDay),
    byVehicle: ranked(vehicleTotals, 'trips'),
    byDriver: ranked(driverTotals, 'trips'),
    fuelByDay: byDate(fuelByDay),
    fuelByVehicle: ranked(fuelByVehicle, 'litres'),
  };
}

const getAnalysis = asyncHandler(async (req, res) => {
  const build = req.project.type === 'underground' ? undergroundAnalysis : openCastAnalysis;
  res.status(200).json({ success: true, data: await build(req.projectModels, req.query) });
});

module.exports = { getAnalysis };
