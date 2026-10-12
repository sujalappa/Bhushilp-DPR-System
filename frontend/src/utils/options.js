// Options for a dropdown: the active master list, plus anything already
// referenced by a saved entry (e.g. a since-deactivated vehicle or level),
// so an existing entry can always be reopened.
export function withReferenced(list, referenced) {
  const seen = new Set(list.map((x) => x._id));
  const extras = [];
  referenced.forEach((x) => {
    if (x && !seen.has(x._id)) {
      seen.add(x._id);
      extras.push(x);
    }
  });
  return [...list, ...extras];
}

// Replace the entry with the same _id, or append it if it's new.
export function upsertById(list, item) {
  return list.some((x) => x._id === item._id) ? list.map((x) => (x._id === item._id ? item : x)) : [...list, item];
}
