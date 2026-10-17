import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as utilizationApi from '../../api/utilization';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import DateShiftPicker from '../../components/DateShiftPicker';
import { shiftLabel } from '../../utils/shift';

// Equipment utilization for one shift, for the whole fleet. A vehicle with
// a Shift Card ran, with its working hours taken from it (closing −
// starting hrs); one without counts as not having run (0%) — nobody has to
// mark it. The supervisor adds idle and breakdown hours and why. A "whole
// shift" line holds time every machine lost together (rain, a blockade), so
// the page also opens on a non-working shift.
export default function UtilizationPage() {
  const { projectId } = useParams();
  return (
    <AppShell title="Equipment Utilization" backTo={`/projects/${projectId}`}>
      <DateShiftPicker projectId={projectId} alsoNonWorking>
        {(date, shift) => <Shift key={`${date}|${shift}`} projectId={projectId} date={date} shift={shift} />}
      </DateShiftPicker>
    </AppShell>
  );
}

const fmt = (n) => (n == null ? '—' : `${Math.round(n * 100) / 100} h`);
const pctTone = (pct) => (pct == null ? 'text-slate-400' : pct >= 75 ? 'text-green-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700');

function Shift({ projectId, date, shift }) {
  const [data, setData] = useState(null); // { shiftHours, wholeShift, vehicles }
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // 'whole' | vehicleId
  const [notice, setNotice] = useState('');

  const reload = useCallback(
    () => utilizationApi.listUtilization(projectId, date, shift).then(setData),
    [projectId, date, shift]
  );

  useEffect(() => {
    let cancelled = false;
    utilizationApi
      .listUtilization(projectId, date, shift)
      .then((utilization) => !cancelled && setData(utilization))
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, date, shift]);

  if (loadError) return <ErrorBanner message={loadError} />;
  if (data === null) return <Spinner full />;

  const ran = data.vehicles.filter((v) => v.ran);
  const didNotRun = data.vehicles.filter((v) => !v.ran);
  const withPct = data.vehicles.filter((v) => v.utilizationPct != null);
  const averagePct = withPct.length
    ? Math.round((withPct.reduce((sum, v) => sum + v.utilizationPct, 0) / withPct.length) * 10) / 10
    : null;

  const save = async (vehicle, values) => {
    await utilizationApi.upsertUtilization(projectId, { date, shift, vehicleId: vehicle?._id || null, ...values });
    await reload();
    setEditing(null);
    setNotice(`Saved: ${vehicle ? vehicle.name : 'whole shift'}`);
  };
  const clear = async (entry, label) => {
    if (!window.confirm(`Clear the saved hours for ${label}? A vehicle goes back to its Shift Card hours.`)) return;
    await utilizationApi.deleteUtilization(projectId, entry._id);
    await reload();
    setEditing(null);
    setNotice(`Cleared: ${label}`);
  };

  const whole = data.wholeShift;
  return (
    <div className="space-y-6">
      {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">✓ {notice}</p>}

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Whole shift (all equipment)</h2>
            <p className="text-sm text-slate-500">Time every machine lost together — rain, blockade, no diesel.</p>
          </div>
          {editing !== 'whole' && (
            <button type="button" className="shrink-0 text-sm font-medium text-brand-600" onClick={() => setEditing('whole')}>
              {whole ? 'Edit' : 'Add'}
            </button>
          )}
        </div>
        {editing === 'whole' ? (
          <HoursEditor
            whole
            entry={whole?.entry}
            shiftHours={data.shiftHours}
            onSave={(values) => save(null, values)}
            onCancel={() => setEditing(null)}
            onClear={whole ? () => clear(whole.entry, 'the whole shift') : null}
          />
        ) : whole ? (
          <div className="text-sm text-slate-700">
            <div>Idle {fmt(whole.idleHrs)}</div>
            {whole.entry.remark && <div className="text-slate-500">“{whole.entry.remark}”</div>}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nothing recorded.</p>
        )}
      </section>

      {data.vehicles.length > 0 && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
          {ran.length} of {data.vehicles.length} vehicles ran
          {averagePct != null && ` · average utilization ${averagePct}%`}
        </p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-600">
          Ran in {shiftLabel(shift)} · {ran.length}
        </h2>
        {ran.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No Shift Cards for this shift yet.
          </p>
        ) : (
          <div className="space-y-2">
            {ran.map((row) => (
              <VehicleRow
                key={row.vehicle._id}
                row={row}
                shiftHours={data.shiftHours}
                editing={editing === row.vehicle._id}
                onEdit={() => setEditing(row.vehicle._id)}
                onCancel={() => setEditing(null)}
                onSave={(values) => save(row.vehicle, values)}
                onClear={row.entry ? () => clear(row.entry, row.vehicle.name) : null}
              />
            ))}
          </div>
        )}
      </section>

      {didNotRun.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-medium text-slate-600">Didn&apos;t run · {didNotRun.length}</h2>
          <p className="mb-2 text-sm text-slate-500">
            No Shift Card this shift, so they count as not having run. Add breakdown or idle hours and why, if known.
          </p>
          <div className="space-y-2">
            {didNotRun.map((row) => (
              <VehicleRow
                key={row.vehicle._id}
                row={row}
                shiftHours={data.shiftHours}
                editing={editing === row.vehicle._id}
                onEdit={() => setEditing(row.vehicle._id)}
                onCancel={() => setEditing(null)}
                onSave={(values) => save(row.vehicle, values)}
                onClear={row.entry ? () => clear(row.entry, row.vehicle.name) : null}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function VehicleRow({ row, shiftHours, editing, onEdit, onCancel, onSave, onClear }) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${editing ? 'border-brand-500' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{row.vehicle.name}</div>
          {row.operators.length > 0 && <div className="text-sm text-slate-500">{row.operators.join(', ')}</div>}
          {!editing && !row.ran && !row.entry && <div className="mt-1 text-sm text-slate-500">No Shift Card — didn&apos;t run</div>}
          {!editing && (row.ran || row.entry) && (
            <div className="mt-1 text-sm text-slate-600">
              Working {fmt(row.workingHrs)}
              {row.idleHrs != null && ` · Idle ${fmt(row.idleHrs)}`}
              {row.breakdownHrs != null && ` · Breakdown ${fmt(row.breakdownHrs)}`}
              {` · of ${fmt(row.availableHrs)}`}
            </div>
          )}
          {!editing && row.entry?.remark && <div className="text-sm text-slate-500">“{row.entry.remark}”</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-lg font-semibold ${pctTone(row.utilizationPct)}`}>
            {row.utilizationPct == null ? '—' : `${row.utilizationPct}%`}
          </div>
          {!editing && (
            <button type="button" className="text-sm font-medium text-brand-600" onClick={onEdit}>
              {row.entry ? 'Edit' : row.ran ? 'Add hours' : 'Add reason'}
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-3">
          <HoursEditor
            entry={row.entry}
            ran={row.ran}
            shiftCardHrs={row.ran ? row.shiftCardHrs : 0}
            shiftHours={shiftHours}
            onSave={onSave}
            onCancel={onCancel}
            onClear={onClear}
          />
        </div>
      )}
    </div>
  );
}

const asText = (v) => (v == null ? '' : String(v));

// The hours for one vehicle (or, `whole`, just idle hours and a reason for
// the whole shift). Working hours start at the Shift Card's figure.
function HoursEditor({ whole = false, ran = true, entry, shiftCardHrs, shiftHours, onSave, onCancel, onClear }) {
  const [values, setValues] = useState(() => ({
    availableHrs: asText(entry?.availableHrs ?? shiftHours),
    workingHrs: asText(entry?.workingHrs ?? shiftCardHrs),
    idleHrs: asText(entry?.idleHrs),
    breakdownHrs: asText(entry?.breakdownHrs),
    remark: entry?.remark || '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));

  const available = Number(values.availableHrs) || 0;
  const working = values.workingHrs === '' ? null : Number(values.workingHrs);
  const pct = working != null && available > 0 ? Math.round((working / available) * 1000) / 10 : null;
  const accounted = [values.workingHrs, values.idleHrs, values.breakdownHrs].reduce((sum, v) => sum + (Number(v) || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = whole
        ? { idleHrs: values.idleHrs, remark: values.remark.trim() }
        : { ...values, remark: values.remark.trim() };
      // Working hours equal to the Shift Card's aren't stored, so a later
      // correction to the Shift Card still flows through.
      if (!whole && shiftCardHrs != null && Number(values.workingHrs) === shiftCardHrs && entry?.workingHrs == null) {
        payload.workingHrs = '';
      }
      await onSave(payload);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {whole ? (
        <NumberField label="Idle hours (all equipment)" min="0" max="24" value={values.idleHrs} onChange={set('idleHrs')} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Available hrs" min="0" max="24" value={values.availableHrs} onChange={set('availableHrs')} />
            <NumberField
              label="Working hrs"
              hint={!ran ? "No Shift Card — didn't run" : shiftCardHrs != null ? `Shift Card: ${fmt(shiftCardHrs)}` : 'No hours on the Shift Card'}
              min="0"
              max="24"
              value={values.workingHrs}
              onChange={set('workingHrs')}
            />
            <NumberField label="Idle hrs" min="0" max="24" value={values.idleHrs} onChange={set('idleHrs')} />
            <NumberField label="Breakdown hrs" min="0" max="24" value={values.breakdownHrs} onChange={set('breakdownHrs')} />
          </div>
          <p className="text-sm text-slate-500">
            Utilization {pct == null ? '—' : `${pct}%`}
            {accounted > available && available > 0 && (
              <span className="text-amber-700"> · working + idle + breakdown is more than the available hours</span>
            )}
          </p>
        </>
      )}
      <Field label={whole ? 'Reason' : 'Remark (optional)'} hint={whole ? 'e.g. "All production hampered due to heavy rain"' : undefined}>
        <input className={inputClass()} value={values.remark} onChange={(e) => set('remark')(e.target.value)} />
      </Field>
      <ErrorBanner message={error} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        {onClear && (
          <button type="button" className="ml-auto text-sm font-medium text-red-600" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
