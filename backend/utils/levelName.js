// Level names in one house style, "-370'L", however they're typed: "370",
// "-370", "370L", "370 l", "-370 'L", "370' L"… all mean the same level, and
// would otherwise become separate levels with entries split between them.
// Anything that isn't a level number (e.g. "Surface") is kept as typed,
// just trimmed.
const LEVEL_NUMBER = /^-?\s*(\d+)\s*['’`]?\s*(?:l|level)?\.?$/i;

function normalizeLevelName(input) {
  const text = String(input ?? '').trim().replace(/\s+/g, ' ');
  const match = text.match(LEVEL_NUMBER);
  return match ? `-${Number(match[1])}'L` : text;
}

module.exports = { normalizeLevelName };
