// Level names in one house style, "-370'L", however they're typed — the
// same rule the server applies (backend/utils/levelName.js), used here only
// to show what will be saved.
const LEVEL_NUMBER = /^-?\s*(\d+)\s*['’`]?\s*(?:l|level)?\.?$/i;

export function normalizeLevelName(input) {
  const text = String(input ?? '').trim().replace(/\s+/g, ' ');
  const match = text.match(LEVEL_NUMBER);
  return match ? `-${Number(match[1])}'L` : text;
}
