const mongoose = require('mongoose');
const AppError = require('./AppError');

// Who did each job on an underground entry. Each trade's head count has a
// list of Worker ids beside it. Names are optional, but there can never be
// more names than the head count says.
const CREW = [
  { idsKey: 'drillerIds', namesKey: 'drillerNames', countKey: 'drillers', label: 'driller' },
  { idsKey: 'helperIds', namesKey: 'helperNames', countKey: 'helpers', label: 'helper' },
  { idsKey: 'muckerIds', namesKey: 'muckerNames', countKey: 'muckers', label: 'mucker' },
  { idsKey: 'blasterIds', namesKey: 'blasterNames', countKey: 'blasters', label: 'blaster' },
];

// A function so each schema gets its own definition objects.
const crewSchemaFields = () =>
  Object.fromEntries(
    CREW.map((c) => [c.idsKey, { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }], default: [] }])
  );

const tidy = (name) => String(name ?? '').trim().replace(/\s+/g, ' ');

// Turns the typed names on a request (drillerNames: ['Ram', ...]) into
// Worker ids, reusing a worker whose name matches ignoring case and adding
// anyone new to the list, so the same person is one record everywhere.
// Rejects more names than the trade's head count.
async function resolveCrew(models, body) {
  const { Worker } = models;
  const wanted = {};
  CREW.forEach((c) => {
    const names = Array.isArray(body[c.namesKey]) ? body[c.namesKey].map(tidy).filter(Boolean) : [];
    const unique = [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];
    const count = Number(body[c.countKey]) || 0;
    if (unique.length > count) {
      throw new AppError(`${unique.length} ${c.label} names entered but the ${c.label} count is ${count}`, 400);
    }
    wanted[c.idsKey] = unique;
  });

  const allNames = Object.values(wanted).flat();
  if (allNames.length === 0) return Object.fromEntries(CREW.map((c) => [c.idsKey, []]));

  const existing = await Worker.find({}, { name: 1 });
  const byName = new Map(existing.map((w) => [w.name.toLowerCase(), w._id]));
  for (const name of allNames) {
    if (!byName.has(name.toLowerCase())) {
      const worker = await Worker.create({ name });
      byName.set(name.toLowerCase(), worker._id);
    }
  }

  return Object.fromEntries(CREW.map((c) => [c.idsKey, wanted[c.idsKey].map((n) => byName.get(n.toLowerCase()))]));
}

const crewPopulate = CREW.map((c) => ({ path: c.idsKey, select: 'name' }));

// "A, B, C" for one trade on a populated entry.
const crewNames = (entry, idsKey) => (entry[idsKey] || []).map((w) => w?.name).filter(Boolean).join(', ');

module.exports = { CREW, crewSchemaFields, resolveCrew, crewPopulate, crewNames };
