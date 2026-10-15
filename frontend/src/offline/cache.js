import { readJson, removeKey, writeJson } from './storage';

// The last server answer for each read the underground forms need, kept on
// the phone so the forms still open with no signal: who's logged in, their
// projects, the work orders and master lists, and what was saved per shift.
// Only these reads are kept — admin pages, export and analysis stay
// online-only.
const CACHEABLE = [
  /^\/auth\/me$/,
  /^\/projects$/,
  /^\/projects\/[^/]+\/(work-orders|levels|supervisors|workers|headings|shift-status|ug-production|ug-development)$/,
];

const PREFIX = 'dpr:cache:';
const INDEX = 'dpr:cache-index';
// Oldest answers are dropped beyond this, so a phone used for months doesn't
// fill its storage with old shifts.
const MAX_ENTRIES = 200;

export const isCacheable = (url) => CACHEABLE.some((re) => re.test(url || ''));

// One key per URL + query, with the query in a fixed order.
export function cacheKey(url, params) {
  const query = Object.keys(params || {})
    .sort()
    .filter((k) => params[k] !== undefined)
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return query ? `${url}?${query}` : url;
}

export function readCached(key) {
  return readJson(PREFIX + key, undefined);
}

export function writeCached(key, body) {
  const index = readJson(INDEX, []).filter((k) => k !== key);
  index.push(key);
  while (index.length > MAX_ENTRIES) removeKey(PREFIX + index.shift());
  writeJson(PREFIX + key, body);
  writeJson(INDEX, index);
}

export function removeCached(key) {
  removeKey(PREFIX + key);
  writeJson(INDEX, readJson(INDEX, []).filter((k) => k !== key));
}

// On log in and log out, so one person's data never shows for another.
export function clearCache() {
  readJson(INDEX, []).forEach((key) => removeKey(PREFIX + key));
  removeKey(INDEX);
}

// Logging in returns the user without a /auth/me call; remember it as if
// there had been one, so reopening the app offline keeps them logged in.
export function rememberUser(user) {
  writeCached('/auth/me', { success: true, data: user });
}
