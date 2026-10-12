// Who did each job on an underground entry: for each head count there is a
// matching list of worker ids. Names are optional — a count can be entered
// without saying who.
export const CREW = [
  { countKey: 'drillers', idsKey: 'drillerIds', label: 'Driller', plural: 'Drillers' },
  { countKey: 'helpers', idsKey: 'helperIds', label: 'Helper', plural: 'Helpers' },
  { countKey: 'muckers', idsKey: 'muckerIds', label: 'Mucker', plural: 'Muckers' },
  { countKey: 'blasters', idsKey: 'blasterIds', label: 'Blaster', plural: 'Blasters' },
];
export const CREW_KEYS = CREW.map((c) => c.idsKey);

export const emptyCrew = () => Object.fromEntries(CREW_KEYS.map((k) => [k, []]));

// A saved entry has the workers populated ({ _id, name }); the form holds ids.
export const crewIdsFromEntry = (entry) =>
  Object.fromEntries(CREW_KEYS.map((k) => [k, (entry[k] || []).map((w) => w._id)]));

// Every worker referenced by any of these entries, for dropdown options.
export const crewWorkers = (entries) => entries.flatMap((e) => CREW_KEYS.flatMap((k) => e[k] || []));

// "Drillers: A, B · Muckers: C" for a saved entry, or '' if no names.
export const crewSummary = (entry) =>
  CREW.map((c) => {
    const names = (entry[c.idsKey] || []).map((w) => w.name).filter(Boolean);
    return names.length > 0 ? `${names.length === 1 ? c.label : c.plural}: ${names.join(', ')}` : null;
  })
    .filter(Boolean)
    .join(' · ');
