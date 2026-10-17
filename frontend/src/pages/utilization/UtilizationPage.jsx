import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as utilizationApi from '../../api/utilization';
import * as mastersApi from '../../api/masters';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import DateShiftPicker from '../../components/DateShiftPicker';
import { shiftLabel } from '../../utils/shift';

// Equipment utilization for one shift. Every vehicle with a Shift Card is
// listed with its working hours already taken from it (closing − starting
// hrs); the supervisor adds idle and breakdown hours and why. A "whole
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
  const [allVehicles, setAllVehicles] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null); // 'whole' | vehicleId
  const [adding, setAdding] = useState(null); // a vehicle without a Shift Card, being added
  const [notice, setNotice] = useState('');

  const reload = useCallback(
    () => utilizationApi.listUtilization(projectId, date, shift).then(setData),
    [projectId, date, shift]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([utilizationApi.listUtilization(projectId, date, shift), mastersApi.listVehicles(projectId, { active: true })])
      .then(([utilization, vehicles]) => {
        if (cancelled) return;
        setData(utilization);
        setAllVehicles(vehicles);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, date, shift]);

  if (loadError) return <ErrorBanner message={loadError} />;
  if (data === null) return <Spinner full />;

  const listed = new Set(data.vehicles.map((v) => v.vehicle._id));
  const addable = allVehicles.filter((v) => !listed.has(v._id));

  const save = async (vehicle, values) => {
    await utilizationApi.upsertUtilization(projectId, { date, shift, vehicleId: vehicle?._id || null, ...values });
    await reload();
    setEditing(null);
    setAdding(null);
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

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-600">
          Vehicles in {shiftLabel(shift)} · {data.vehicles.length}
        </h2>
        {data.vehicles.length === 0 && !adding && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No Shift Cards for this shift yet. Vehicles appear here once their Shift Card is saved, or add one below.
          </p>
        )}
        <div className="space-y-2">
          {data.vehicles.map((row) => (
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
          {adding && (
            <div className="rounded-lg border border-brand-500 bg-white p-4 shadow-sm">
              <div className="mb-3 font-medium text-slate-900">{adding.name}</div>
              <HoursEditor shiftHours={data.shiftHours} onSave={(values) => save(adding, values)} onCancel={() => setAdding(null)} />
            </div>
          )}
        </div>
        {!adding && addable.length > 0 && (
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Add a vehicle without a Shift Card</span>
            <select
              className={inputClass()}
              value=""
              onChange={(e) => setAdding(addable.find((v) => v._id === e.target.value) || null)}
            >
              <option value="">Select…</option>
              {addable.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
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
          {!editing && (
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
              {row.entry ? 'Edit' : 'Add hours'}
            </button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-3">
          <HoursEditor
            entry={row.entry}
            shiftCardHrs={row.shiftCardHrs}
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
function HoursEditor({ whole = false, entry, shiftCardHrs, shiftHours, onSave, onCancel, onClear }) {
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
              hint={shiftCardHrs != null ? `Shift Card: ${fmt(shiftCardHrs)}` : 'No hours on the Shift Card'}
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
