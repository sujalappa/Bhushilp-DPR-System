import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { INK, SERIES_COLORS, formatDay, formatDayLong, formatNumber, formatTick } from '../utils/chartHelpers';

// Chart building blocks for the Analysis page. The rules they share:
// thin marks, a legend whenever there's more than one series, text in ink
// colours (never the series colour), one y-axis per chart, and a table
// view of the same figures behind every chart.

const axisTick = { fill: INK.muted, fontSize: 12 };

export function StatTile({ label, value, note }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {note && <div className="mt-0.5 text-xs text-slate-500">{note}</div>}
    </div>
  );
}

function Legend({ series }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// `table` is { columns: [{ key, label, format?, align? }], rows } — the
// same figures as the chart, for reading exact values.
export function ChartCard({ title, subtitle, series, table, children }) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {table && (
          <button
            type="button"
            className="shrink-0 text-sm font-medium text-brand-600"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? 'Show chart' : 'Show table'}
          </button>
        )}
      </div>

      {/* One series needs no legend — the title already says what it is. */}
      {!showTable && series?.length > 1 && <Legend series={series} />}

      {showTable ? <DataTable {...table} /> : children}
    </section>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr className="border-b border-slate-200 text-slate-600">
            {columns.map((c) => (
              <th key={c.key} className={`whitespace-nowrap px-3 py-2 font-medium ${c.align === 'left' ? 'text-left' : 'text-right'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`whitespace-nowrap px-3 py-2 tabular-nums ${c.align === 'left' ? 'text-left text-slate-900' : 'text-right text-slate-700'}`}
                >
                  {c.format ? c.format(row[c.key]) : formatNumber(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip({ active, payload, label, unit, formatLabel, showTotal }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null);
  const total = rows.reduce((sum, p) => sum + (p.value || 0), 0);
  const withUnit = (v) => `${formatNumber(v)}${unit ? ` ${unit}` : ''}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 font-medium text-slate-900">{formatLabel ? formatLabel(label) : label}</div>
      {rows.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-slate-900">{withUnit(p.value)}</span>
        </div>
      ))}
      {showTotal && rows.length > 1 && (
        <div className="mt-1 flex justify-between gap-4 border-t border-slate-100 pt-1 text-slate-600">
          <span>Total</span>
          <span className="font-medium tabular-nums text-slate-900">{withUnit(total)}</span>
        </div>
      )}
    </div>
  );
}

// Columns over time, one stack per day. `series` is [{ key, label, color }].
// The top segment of each stack gets the rounded end; segments are parted
// by a 2px gap in the surface colour rather than an outline.
export function StackedColumns({ data, series, unit, height = 260 }) {
  const topKey = (row) => {
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if (row[series[i].key] > 0) return series[i].key;
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={INK.grid} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: INK.axis }}
          minTickGap={16}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatTick} width={44} />
        <Tooltip
          cursor={{ fill: 'rgba(11,11,11,0.04)' }}
          content={<ChartTooltip unit={unit} formatLabel={formatDayLong} showTotal />}
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="stack"
            fill={s.color}
            maxBarSize={24}
            isAnimationActive={false}
            shape={(props) => (
              <Rectangle
                {...props}
                stroke={INK.surface}
                strokeWidth={2}
                radius={topKey(props.payload) === s.key ? [4, 4, 0, 0] : 0}
              />
            )}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Ranked comparison: one bar per name, longest first, value at the tip.
// Every bar is labelled, so there are no axis numbers to read off.
export function HorizontalBars({ data, dataKey, unit, color = SERIES_COLORS[0], label }) {
  const longest = data.reduce((max, d) => Math.max(max, String(d.name).length), 0);
  const nameWidth = Math.min(150, Math.max(56, longest * 7.5 + 8));
  const shorten = (name) => (String(name).length > 19 ? `${String(name).slice(0, 18)}…` : name);

  return (
    <ResponsiveContainer width="100%" height={data.length * 34 + 16}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={nameWidth}
          tick={{ fill: INK.secondary, fontSize: 13 }}
          tickFormatter={shorten}
          tickLine={false}
          axisLine={{ stroke: INK.axis }}
        />
        <Tooltip cursor={{ fill: 'rgba(11,11,11,0.04)' }} content={<ChartTooltip unit={unit} />} />
        <Bar dataKey={dataKey} name={label} fill={color} barSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey={dataKey} position="right" formatter={formatNumber} fill={INK.primary} fontSize={13} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// One measure over time. Dots only when there are few enough points to
// read them individually; gaps (null) are left as gaps.
export function TrendLine({ data, dataKey, label, unit, color = SERIES_COLORS[0], height = 220 }) {
  const dot = data.length <= 14 ? { r: 4, fill: color, stroke: INK.surface, strokeWidth: 2 } : false;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={INK.grid} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: INK.axis }}
          minTickGap={16}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={formatTick} width={44} />
        <Tooltip
          cursor={{ stroke: INK.axis }}
          content={<ChartTooltip unit={unit} formatLabel={formatDayLong} />}
        />
        <Line
          type="linear"
          dataKey={dataKey}
          name={label}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={dot}
          activeDot={{ r: 5, fill: color, stroke: INK.surface, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
