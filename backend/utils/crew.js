const mongoose = require('mongoose');

// Who did each job on an underground entry. Each is a list of Worker ids,
// stored alongside the head count for that trade (drillers, helpers, …).
// Names are optional — a count can be entered without saying who.
const CREW_KEYS = ['drillerIds', 'helperIds', 'muckerIds', 'blasterIds'];

// A function so each schema gets its own definition objects.
const crewSchemaFields = () =>
  Object.fromEntries(
    CREW_KEYS.map((key) => [key, { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Worker' }], default: [] }])
  );

// Reads the crew lists off a request body, dropping anything that isn't a
// valid id and any duplicates.
function crewFromBody(body) {
  const out = {};
  CREW_KEYS.forEach((key) => {
    const ids = Array.isArray(body[key]) ? body[key] : [];
    out[key] = [...new Set(ids.filter((id) => mongoose.isValidObjectId(id)).map(String))];
  });
  return out;
}

const crewPopulate = CREW_KEYS.map((path) => ({ path, select: 'name' }));

// "A, B, C" for one trade on a populated entry.
const crewNames = (entry, key) => (entry[key] || []).map((w) => w?.name).filter(Boolean).join(', ');

module.exports = { CREW_KEYS, crewSchemaFields, crewFromBody, crewPopulate, crewNames };
