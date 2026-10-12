import { ChartCard, HorizontalBars, StackedColumns } from '../../../components/charts';
import { formatDayLong } from '../../../utils/chartHelpers';

const MAX_BARS = 12;

// A stacked-columns-over-time card, with its table view built from the
// same series and rows.
export function StackCard({ title, subtitle, stack, unit }) {
  if (stack.data.length === 0) return null;

  const table = {
    columns: [
      { key: 'date', label: 'Date', align: 'left', format: formatDayLong },
      ...stack.series.map((s) => ({ key: s.key, label: s.label })),
      ...(stack.series.length > 1 ? [{ key: 'total', label: 'Total' }] : []),
    ],
    rows: stack.data,
  };

  return (
    <ChartCard title={title} subtitle={subtitle} series={stack.series} table={table}>
      <StackedColumns data={stack.data} series={stack.series} unit={unit} />
    </ChartCard>
  );
}

// A ranked horizontal-bar card. The chart shows the top few; the table
// view always has every row and any extra columns.
export function RankCard({ title, subtitle, rows, dataKey, label, unit, nameLabel, extraColumns = [] }) {
  if (rows.length === 0) return null;

  const shown = rows.slice(0, MAX_BARS);
  const note = rows.length > MAX_BARS ? `Top ${MAX_BARS} of ${rows.length}. The table has all of them.` : null;
  const table = {
    columns: [{ key: 'name', label: nameLabel, align: 'left', format: (v) => v }, { key: dataKey, label }, ...extraColumns],
    rows,
  };

  return (
    <ChartCard title={title} subtitle={[subtitle, note].filter(Boolean).join(' ')} table={table}>
      <HorizontalBars data={shown} dataKey={dataKey} label={label} unit={unit} />
    </ChartCard>
  );
}

export function EmptyRange() {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
      No entries in this date range.
    </p>
  );
}
