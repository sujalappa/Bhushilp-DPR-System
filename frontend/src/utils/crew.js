// Who did each job on an underground entry. Each trade's head count has one
// name box per person; names are optional but can't outnumber the count.
// The form works in names; the server matches them to the shared worker
// list (adding anyone new) and stores ids.
export const CREW = [
  { countKey: 'drillers', idsKey: 'drillerIds', namesKey: 'drillerNames', label: 'Driller', plural: 'Drillers' },
  { countKey: 'helpers', idsKey: 'helperIds', namesKey: 'helperNames', label: 'Helper', plural: 'Helpers' },
  { countKey: 'muckers', idsKey: 'muckerIds', namesKey: 'muckerNames', label: 'Mucker', plural: 'Muckers' },
  { countKey: 'blasters', idsKey: 'blasterIds', namesKey: 'blasterNames', label: 'Blaster', plural: 'Blasters' },
];
export const CREW_NAME_KEYS = CREW.map((c) => c.namesKey);

// More name boxes than this would be a typo in the count, not a gang.
export const MAX_CREW = 30;

// The name list resized to the count: one box per person, keeping what's
// already typed in the boxes that remain.
export const fitNames = (names, count) => {
  const n = Math.max(0, Math.min(MAX_CREW, Math.floor(Number(count) || 0)));
  return Array.from({ length: n }, (_, i) => names[i] ?? '');
};

export const emptyCrew = () => Object.fromEntries(CREW_NAME_KEYS.map((k) => [k, []]));

// A saved entry has the workers populated ({ _id, name }); the form holds
// one name per counted person.
export const crewNamesFromEntry = (entry) =>
  Object.fromEntries(
    CREW.map((c) => [c.namesKey, fitNames((entry[c.idsKey] || []).map((w) => w.name), entry[c.countKey])])
  );

// Every worker referenced by any of these entries, for name suggestions.
export const crewWorkers = (entries) => entries.flatMap((e) => CREW.flatMap((c) => e[c.idsKey] || []));

// "Drillers: A, B · Muckers: C" for a saved entry, or '' if no names.
export const crewSummary = (entry) =>
  CREW.map((c) => {
    const names = (entry[c.idsKey] || []).map((w) => w.name).filter(Boolean);
    return names.length > 0 ? `${names.length === 1 ? c.label : c.plural}: ${names.join(', ')}` : null;
  })
    .filter(Boolean)
    .join(' · ');
