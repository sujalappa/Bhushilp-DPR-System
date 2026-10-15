import { useState } from 'react';
import { formatRupees } from '../../utils/workOrder';

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const n = (v) => (v == null ? '–' : numberFormat.format(v));

const PERIODS = [
  { key: 'day', label: 'This day' },
  { key: 'monthToDate', label: 'Month to date' },
];

// The workbook's labour block for the work order, worked out by the server
// with the work order's rates: each driller and helper man-shift is
// credited at wage + add-on, converted to m³ at the rate per m³, then added
// to production to give Total Cum and the billing amount. Covers every
// shift of the day, or the month up to the day.
//
// Billing figures are for the superadmin only: the server leaves `labour`
// out (null) for everyone else, and the section then says so when opened.
// `canView` tells that apart from the superadmin being offline with nothing
// loaded for the day.
export default function LabourAndBilling({ date, labour, canView }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">Labour and billing</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Admin only</span>
        </span>
        <span aria-hidden="true" className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4 pt-3">
          {labour ? (
            <Figures date={date} labour={labour} />
          ) : canView ? (
            <p className="text-sm text-slate-600">Needs internet to load. Open this again once there&apos;s signal.</p>
          ) : (
            <p className="text-sm text-slate-600">Not accessible. Only admins can see labour and billing figures.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Figures({ date, labour }) {
  const [period, setPeriod] = useState('day');
  const figures = labour[period];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex gap-1 rounded-full bg-slate-100 p-1" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                period === p.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-slate-500">
        {period === 'day' ? `All shifts on ${date}.` : `1st of the month to ${date}.`} Rate {formatRupees(figures.ratePerCubicMetre)} per m³.
      </p>

      {/* Phones: one line per category, so every figure is on screen. */}
      <div className="space-y-2 sm:hidden">
        {figures.rows.map((r) => (
          <div key={r.category} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="flex justify-between font-medium text-slate-900">
              <span>{r.category}</span>
              <span className="tabular-nums">{n(r.cubicMetres)} m³</span>
            </div>
            <div className="mt-1 tabular-nums text-slate-600">
              ({n(r.wage)} + {n(r.markup)}) = {n(r.perManShift)} × {n(r.manShifts)} man-shifts = {n(r.amount)}
            </div>
          </div>
        ))}
        <div className="flex justify-between rounded-lg bg-amber-50 p-3 text-sm font-semibold text-slate-900">
          <span>Total M3 Meter</span>
          <span className="tabular-nums">{n(figures.labourCubicMetres)}</span>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-right text-slate-600">
              <th className="px-3 py-2 text-left font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Wage</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">{n(figures.wageMarkupPct)}%</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Man-shifts</th>
              <th className="px-3 py-2 font-medium">Total</th>
              <th className="px-3 py-2 font-medium">Cum (m³)</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {figures.rows.map((r) => (
              <tr key={r.category} className="border-b border-slate-100 text-right text-slate-700">
                <td className="px-3 py-2 text-left font-medium text-slate-900">{r.category}</td>
                <td className="px-3 py-2">{n(r.wage)}</td>
                <td className="px-3 py-2">{n(r.markup)}</td>
                <td className="px-3 py-2">{n(r.perManShift)}</td>
                <td className="px-3 py-2">{n(r.manShifts)}</td>
                <td className="px-3 py-2">{n(r.amount)}</td>
                <td className="px-3 py-2">{n(r.cubicMetres)}</td>
              </tr>
            ))}
            <tr className="bg-amber-50 text-right font-semibold text-slate-900">
              <td className="px-3 py-2 text-left" colSpan={6}>
                Total M3 Meter
              </td>
              <td className="px-3 py-2">{n(figures.labourCubicMetres)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-slate-500">Production (m³)</dt>
        <dd className="text-right tabular-nums text-slate-900">{n(figures.productionCubicMetres)}</dd>
        <dt className="text-slate-500">Labour (m³)</dt>
        <dd className="text-right tabular-nums text-slate-900">{n(figures.labourCubicMetres)}</dd>
        <dt className="font-medium text-slate-700">Total Cum (m³)</dt>
        <dd className="text-right font-semibold tabular-nums text-slate-900">{n(figures.totalCum)}</dd>
        <dt className="font-medium text-slate-700">Billing amount</dt>
        <dd className="text-right font-semibold tabular-nums text-slate-900">{formatRupees(figures.billingAmount)}</dd>
      </dl>
    </div>
  );
}
