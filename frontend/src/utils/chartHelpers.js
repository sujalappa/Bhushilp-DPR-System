// Colours and formatting shared by every chart on the Analysis page.

// Categorical series colours, assigned in this fixed order and never
// cycled. The order is what keeps neighbouring colours distinguishable for
// colour-blind readers (validated against the white card surface), so
// don't reorder or extend it — past eight series, fold the rest into
// "Other" (see buildStack).
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const OTHER_COLOR = '#898781';

export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  surface: '#ffffff',
};

// A shift keeps its colour whichever shifts happen to have data.
export const SHIFT_COLORS = { I: SERIES_COLORS[0], II: SERIES_COLORS[1], III: SERIES_COLORS[2], General: SERIES_COLORS[3] };
export const SHIFT_LABELS = { I: 'Shift I', II: 'Shift II', III: 'Shift III', General: 'General' };

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const formatNumber = (n) => (n == null ? '–' : numberFormat.format(n));

// Axis ticks: compact from 1,000 up.
export const formatTick = (n) => (Math.abs(n) >= 1000 ? `${numberFormat.format(Math.round(n / 100) / 10)}K` : numberFormat.format(n));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-09-01" -> "1 Sep" (axis) / "1 Sep 2026" (tooltip, table).
export const formatDay = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
export const formatDayLong = (iso) => `${formatDay(iso)} ${iso.slice(0, 4)}`;

// Turns rows like { date, '-370': 19.5, '-470': 15 } into what a stacked
// chart needs: a series list with colours, and rows with every series
// present. `names` is the full ordered list of series; beyond `max` the
// smallest are folded into one "Other" series rather than given new hues.
export function buildStack(rows, names, { max = 7, colors = null, labels = null } = {}) {
  const totals = Object.fromEntries(names.map((n) => [n, rows.reduce((sum, r) => sum + (r[n] || 0), 0)]));
  const kept = names.length > max + 1 ? [...names].sort((a, b) => totals[b] - totals[a]).slice(0, max) : names;
  const keptSet = new Set(kept);
  const folded = names.filter((n) => !keptSet.has(n));

  const series = names
    .filter((n) => keptSet.has(n))
    .map((name, i) => ({
      key: name,
      label: labels?.[name] || name,
      color: colors?.[name] || SERIES_COLORS[i % SERIES_COLORS.length],
    }));
  if (folded.length > 0) series.push({ key: 'Other', label: `Other (${folded.length})`, color: OTHER_COLOR });

  const data = rows.map((row) => {
    const out = { date: row.date };
    kept.forEach((n) => {
      out[n] = row[n] || 0;
    });
    if (folded.length > 0) out.Other = folded.reduce((sum, n) => sum + (row[n] || 0), 0);
    out.total = series.reduce((sum, s) => sum + out[s.key], 0);
    return out;
  });

  return { series, data };
}
