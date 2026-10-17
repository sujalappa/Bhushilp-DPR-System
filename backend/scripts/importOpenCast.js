// Imports an open-cast mine's daily reporting workbook (the Kamptee
// "Daily Reporting Formats" layout) into a project:
//   Fleet trip count 2 + 03_Daily_Fleet_Trip_Count 1 → Shift Card entries
//     (KM / hours / fuel readings and trip counts, matched by date + shift +
//     vehicle + driver); "All Equipements" rows → the shift's status/reason
//   07_Daily_Production  → Daily Production (remarks, hard OB, target;
//                          OB Rehandling is worked out from the trips)
//   08_Equipment_Utilization → Equipment Utilization
// The fuel sheet is deliberately not imported.
//
// Usage (from backend/):
//   node scripts/importOpenCast.js "<project name>" "<workbook.xlsx>"            dry run: report only
//   node scripts/importOpenCast.js "<project name>" "<workbook.xlsx>" --apply    write
//   ... --apply --replace   first delete everything already in the project
//                           (entries, vehicles, drivers) — for replacing test data
//
// Safe to run twice: every row is upserted on the same key the app uses.

require('dotenv').config();
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const connectCentralDb = require('../config/db');
const Project = require('../models/central/Project');
const { getProjectConnection } = require('../config/projectDb');
const { OB_PER_TRIP } = require('../utils/obFactors');

// The same machine typed differently across sheets → one name.
const VEHICLE_ALIASES = {
  'bd155-5660': 'BD-155/5660',
  'dozer - 5660': 'BD-155/5660',
  '8430 water tanker': 'Water Tanker-8430',
  'pc-450/komatsu': 'PC-450/KOMATSU/5953',
  'gredar-7': 'G-7',
  'dozer 5987': 'Dumper- 5987',
};

const tidy = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
const cellValue = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('result' in v || v.formula || v.sharedFormula) return cellValue(v.result);
    if (v.error) return null;
    if (v.text) return v.text;
  }
  return v;
};
const num = (v) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return v == null || String(v).trim() === '' || !Number.isFinite(n) ? null : n;
};
const dayOf = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : null);
const shiftOf = (v) => {
  const s = tidy(v).toUpperCase();
  return ['I', 'II', 'III'].includes(s) ? s : 'General'; // General, NA, blank
};
const isAllEquipment = (name) => /^all equip/i.test(name);
const vehicleName = (raw) => {
  const name = tidy(raw);
  return VEHICLE_ALIASES[name.toLowerCase()] || name;
};
function categoryOf(name) {
  if (/^(tipper|tt|dt)\b|tipper/i.test(name)) return 'tipper';
  if (/dumper/i.test(name)) return 'dumper';
  if (/^(ex|pc)\b|ex -|komatsu|jcb/i.test(name)) return 'excavator';
  if (/dozer|^bd/i.test(name)) return 'dozer';
  if (/loader/i.test(name)) return 'loader';
  return 'other';
}

function readSheet(wb, name) {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Sheet "${name}" not found`);
  const header = [];
  ws.getRow(1).eachCell((c, i) => (header[i] = tidy(cellValue(c.value))));
  const rows = [];
  ws.eachRow((row, r) => {
    if (r === 1) return;
    const o = { row: r };
    header.forEach((h, i) => h && (o[h] = cellValue(row.getCell(i).value)));
    rows.push(o);
  });
  return rows;
}

async function main() {
  const [, , projectName, file, ...flags] = process.argv;
  const apply = flags.includes('--apply');
  const replace = flags.includes('--replace');
  if (!projectName || !file) {
    console.error('Usage: node scripts/importOpenCast.js "<project name>" "<workbook.xlsx>" [--apply] [--replace]');
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const problems = [];
  const problem = (sheet, row, text) => problems.push(`${sheet} row ${row}: ${text}`);

  // ---- drivers: one spelling per person (the most used one) ----
  const t2 = readSheet(wb, 'Fleet trip count 2');
  const t1 = readSheet(wb, '03_Daily_Fleet_Trip_Count 1');
  const spellings = new Map();
  [...t2.map((o) => o.Driver), ...t1.map((o) => o.Driver)].forEach((raw) => {
    const name = tidy(raw);
    if (!name || name === '-') return;
    const key = name.toLowerCase();
    const counts = spellings.get(key) || new Map();
    counts.set(name, (counts.get(name) || 0) + 1);
    spellings.set(key, counts);
  });
  const driverName = (raw) => {
    const name = tidy(raw);
    if (!name || name === '-') return null;
    const counts = spellings.get(name.toLowerCase());
    // Most used spelling; on a tie, the one with more capitals ("Vishal Kekati").
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || (b[0].match(/[A-Z]/g) || []).length - (a[0].match(/[A-Z]/g) || []).length)[0][0];
  };

  // ---- shift cards ----
  const logs = new Map(); // date|shift|vehicle|driver → log
  const statuses = new Map(); // date|shift → { remarks:Set }
  const keyOf = (day, shift, vehicle, driver) => `${day}|${shift}|${vehicle}|${driver || ''}`;
  const addRemark = (target, text) => text && !target.remarks.includes(text) && target.remarks.push(text);

  const takeShiftRow = (sheet, o, isReadings) => {
    const day = dayOf(o.Date);
    const rawVehicle = tidy(o['Name of Equipment']);
    const remark = tidy(isReadings ? o.Remark : o.Remarks);
    const hasData = isReadings
      ? ['Starting KM', 'Closing KM', 'Starting Hrs', 'Closing Hrs.', 'Fuel Opening', 'Fuel Closing'].some((k) => num(o[k]) != null)
      : num(o['Trip No']) != null;
    if (!day) {
      if (rawVehicle || hasData || remark) problem(sheet, o.row, 'no date — skipped');
      return;
    }
    const shift = shiftOf(o.Shift);
    if (isAllEquipment(rawVehicle)) {
      const s = statuses.get(`${day}|${shift}`) || { day, shift, remarks: [] };
      addRemark(s, remark);
      statuses.set(`${day}|${shift}`, s);
      return;
    }
    if (!rawVehicle) {
      if (hasData) problem(sheet, o.row, 'no equipment name — skipped');
      return;
    }
    const vehicle = vehicleName(rawVehicle);
    let driver = driverName(o.Driver);
    let key = keyOf(day, shift, vehicle, driver);
    // A trip row without a driver belongs to that vehicle's only reading row.
    if (!isReadings && !driver && !logs.has(key)) {
      const prefix = `${day}|${shift}|${vehicle}|`;
      const same = [...logs.keys()].filter((k) => k.startsWith(prefix));
      if (same.length === 1) {
        key = same[0];
        driver = logs.get(key).driver;
      }
    }
    const log = logs.get(key) || { day, shift, vehicle, driver, remarks: [], rows: [] };
    log.rows.push(`${sheet.slice(0, 2)}:${o.row}`);
    if (isReadings) {
      const readings = {
        startKm: num(o['Starting KM']),
        closeKm: num(o['Closing KM']),
        startHrs: num(o['Starting Hrs']),
        closeHrs: num(o['Closing Hrs.']),
        fuelOpen: num(o['Fuel Opening']),
        fuelClose: num(o['Fuel Closing']),
      };
      if (log.readings) {
        problem(sheet, o.row, `second reading row for ${vehicle} ${day} ${shift} ${driver || '(no driver)'} — kept the lowest start / highest close`);
        const r = log.readings;
        const lo = (a, b) => (a == null ? b : b == null ? a : Math.min(a, b));
        const hi = (a, b) => (a == null ? b : b == null ? a : Math.max(a, b));
        log.readings = { startKm: lo(r.startKm, readings.startKm), closeKm: hi(r.closeKm, readings.closeKm), startHrs: lo(r.startHrs, readings.startHrs), closeHrs: hi(r.closeHrs, readings.closeHrs), fuelOpen: r.fuelOpen ?? readings.fuelOpen, fuelClose: readings.fuelClose ?? r.fuelClose };
      } else {
        log.readings = readings;
      }
    } else {
      const trips = num(o['Trip No']);
      if (trips != null) log.trips = (log.trips || 0) + trips;
    }
    addRemark(log, remark);
    logs.set(key, log);
  };
  t2.forEach((o) => takeShiftRow('Fleet trip count 2', o, true));
  t1.forEach((o) => takeShiftRow('Fleet Trip Count 1', o, false));

  logs.forEach((l) => {
    const r = l.readings || {};
    if (r.startKm != null && r.closeKm != null && r.closeKm < r.startKm) problem('Shift card', l.rows.join(','), `${l.vehicle} ${l.day} ${l.shift}: closing KM ${r.closeKm} below starting ${r.startKm}`);
    if (r.startHrs != null && r.closeHrs != null && r.closeHrs < r.startHrs) problem('Shift card', l.rows.join(','), `${l.vehicle} ${l.day} ${l.shift}: closing hrs ${r.closeHrs} below starting ${r.startHrs}`);
  });

  // ---- production ----
  const production = [];
  const tripsByShift = new Map();
  logs.forEach((l) => tripsByShift.set(`${l.day}|${l.shift}`, (tripsByShift.get(`${l.day}|${l.shift}`) || 0) + (l.trips || 0)));
  readSheet(wb, '07_Daily_Production').forEach((o) => {
    const day = dayOf(o.Date);
    if (!day) return;
    const shift = shiftOf(o.Shift);
    const sheetReh = num(o['OB Rehandling']);
    const appReh = (tripsByShift.get(`${day}|${shift}`) || 0) * OB_PER_TRIP['ob-rehandling'];
    if (sheetReh != null && sheetReh !== appReh) problem('07_Daily_Production', o.row, `${day} ${shift}: sheet OB Rehandling ${sheetReh}, the app works out ${appReh} from the trips`);
    const entry = { day, shift, hardOB: num(o['Hard OB']), softOB: num(o['Soft OB']), target: num(o.Target), remark: tidy(o.Remarks) };
    if (entry.hardOB != null || entry.softOB != null || entry.target != null || entry.remark) production.push(entry);
  });

  // ---- equipment utilization ----
  const utilization = [];
  readSheet(wb, '08_Equipment_Utilization').forEach((o) => {
    const day = dayOf(o.Date);
    const hours = ['Available Hrs', 'Working Hrs', 'Idle Hrs', 'Breakdown Hrs'].map((k) => num(o[k]));
    const remark = tidy(o.Remarks);
    if (!day || (hours.every((h) => h == null) && !remark)) return;
    const raw = tidy(o['Name of Equipment']);
    utilization.push({
      day,
      shift: shiftOf(o.Shift),
      vehicle: raw && !isAllEquipment(raw) ? vehicleName(raw) : null,
      availableHrs: hours[0],
      workingHrs: hours[1],
      idleHrs: hours[2],
      breakdownHrs: hours[3],
      remark,
    });
  });

  // ---- summary ----
  const vehicles = new Set([...logs.values()].map((l) => l.vehicle));
  utilization.forEach((u) => u.vehicle && vehicles.add(u.vehicle));
  const drivers = new Set([...logs.values()].map((l) => l.driver).filter(Boolean));
  const shiftsWithLogs = new Set([...logs.values()].map((l) => `${l.day}|${l.shift}`));
  const days = [...logs.values()].map((l) => l.day).sort();
  console.log(`Workbook: ${file}`);
  console.log(`  Shift Card entries:      ${logs.size} (${days[0]} → ${days.at(-1)}), ${[...logs.values()].filter((l) => l.trips != null).length} with trips`);
  console.log(`  Vehicles:                ${vehicles.size}`);
  console.log(`  Drivers:                 ${drivers.size}`);
  console.log(`  Shift reasons (all equipment idle): ${statuses.size} (${[...statuses.keys()].filter((k) => !shiftsWithLogs.has(k)).length} with no vehicle working → non-working shift)`);
  console.log(`  Daily Production:        ${production.length}`);
  console.log(`  Equipment Utilization:   ${utilization.length}`);
  console.log(`  Problems:                ${problems.length}`);
  problems.forEach((p) => console.log('   -', p));

  // ---- write ----
  await connectCentralDb();
  const project = await Project.findOne({ name: projectName });
  if (!project) throw new Error(`No project named "${projectName}"`);
  if (project.type === 'underground') throw new Error('This importer is for open-cast projects');
  const { models } = await getProjectConnection(project.dbName);
  const COLLECTIONS = ['Trip', 'ShiftLog', 'ShiftStatus', 'DailyProduction', 'FuelLog', 'EquipmentUtilization', 'Vehicle', 'Driver', 'LoadingPoint'];
  const existing = {};
  for (const m of COLLECTIONS) existing[m] = await models[m].find({}, { _id: 1 }).lean();
  console.log(`\nProject "${project.name}" (${project.dbName}) has now:`, COLLECTIONS.map((m) => `${m} ${existing[m].length}`).join(', '));

  if (!apply) {
    console.log('\nDry run — nothing written. Add --apply to import' + (replace ? '' : ' (and --replace to delete what is there first)') + '.');
    await mongoose.disconnect();
    return;
  }

  if (replace) {
    for (const m of COLLECTIONS) {
      if (existing[m].length === 0) continue;
      const { deletedCount } = await models[m].deleteMany({ _id: { $in: existing[m].map((d) => d._id) } });
      console.log(`Deleted ${deletedCount} ${m}`);
    }
  }

  const userId = null;
  // Masters, matched by name ignoring case.
  const ensure = async (Model, names, extra = () => ({})) => {
    const ids = new Map();
    const current = await Model.find({}, { name: 1 });
    current.forEach((d) => ids.set(d.name.toLowerCase(), d._id));
    for (const name of names) {
      if (!ids.has(name.toLowerCase())) ids.set(name.toLowerCase(), (await Model.create({ name, ...extra(name) }))._id);
    }
    return (name) => (name ? ids.get(name.toLowerCase()) : null);
  };
  const vehicleId = await ensure(models.Vehicle, [...vehicles].sort(), (name) => ({ category: categoryOf(name) }));
  const driverId = await ensure(models.Driver, [...drivers].sort());

  const at = (day) => new Date(day);
  const upserts = (filter, set) => ({ updateOne: { filter, update: { $set: set }, upsert: true } });
  const write = async (Model, ops, label) => {
    if (ops.length === 0) return;
    const r = await Model.bulkWrite(ops, { ordered: false });
    console.log(`${label}: ${r.upsertedCount} added, ${r.modifiedCount} updated`);
  };

  await write(
    models.ShiftLog,
    [...logs.values()].map((l) =>
      upserts(
        { date: at(l.day), shift: l.shift, vehicleId: vehicleId(l.vehicle), driverId: driverId(l.driver) },
        {
          status: 'working',
          ...(l.readings || {}),
          totalTripsManual: l.trips ?? null,
          handlingType: 'ob-rehandling',
          remark: l.remarks.join(' · '),
          createdBy: userId,
        }
      )
    ),
    'Shift Card entries'
  );
  await write(
    models.ShiftStatus,
    [...statuses.values()].map((s) =>
      upserts(
        { date: at(s.day), shift: s.shift },
        // A shift where some vehicles still worked stays "working", with the reason as its remark.
        { status: shiftsWithLogs.has(`${s.day}|${s.shift}`) ? 'working' : 'non-working', remark: s.remarks.join(' · ') || 'All equipment idle' }
      )
    ),
    'Shift statuses'
  );
  await write(
    models.DailyProduction,
    production.map((p) =>
      upserts(
        { date: at(p.day), shift: p.shift },
        { hardOB: p.hardOB ?? 0, softOB: p.softOB ?? 0, target: p.target, remark: p.remark, createdBy: userId }
      )
    ),
    'Daily Production'
  );
  await write(
    models.EquipmentUtilization,
    utilization.map((u) =>
      upserts(
        { date: at(u.day), shift: u.shift, vehicleId: vehicleId(u.vehicle) },
        { availableHrs: u.availableHrs, workingHrs: u.workingHrs, idleHrs: u.idleHrs, breakdownHrs: u.breakdownHrs, remark: u.remark, createdBy: userId }
      )
    ),
    'Equipment Utilization'
  );

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
