import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import * as mastersApi from '../../api/masters';
import * as fuelApi from '../../api/fuel';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import PickOrAdd from '../../components/PickOrAdd';
import { todayIso } from '../../utils/date';

// Daily fuel on one page: date at the top, one entry form, and the list of
// what's already saved for that date underneath. There's no shift here —
// fuel is issued once a day per vehicle (see the FuelLog model), and it
// applies to every vehicle, excavators and dozers included.
export default function FuelPage() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const today = todayIso();
  const rawDate = params.get('date') || '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate <= today ? rawDate : today;

  return (
    <AppShell title="Fuel Consumption" backTo={`/projects/${projectId}`}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <Field label="Date">
            <input
              type="date"
              max={today}
              className={inputClass()}
              value={date}
              onChange={(e) => setParams({ date: e.target.value }, { replace: true })}
            />
          </Field>
        </div>

        {/* Keyed so switching date starts from a clean form. */}
        <FuelEntries key={date} projectId={projectId} date={date} />
      </div>
    </AppShell>
  );
}

const NUMERIC_KEYS = ['fuelIssued', 'openingKm', 'closingKm', 'openingFuel', 'closingFuel'];
const emptyFields = { ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, ''])), remark: '' };

const fieldsFromLog = (log) => ({
  ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, log[k] ?? ''])),
  remark: log.remark || '',
});

function FuelEntries({ projectId, date }) {
  const [vehicles, setVehicles] = useState([]);
  const [logs, setLogs] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [vehicleId, setVehicleId] = useState('');
  const [fields, setFields] = useState(emptyFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([mastersApi.listVehicles(projectId, { active: true }), fuelApi.listFuelLogs(projectId, date)])
      .then(([vehicleList, logList]) => {
        if (cancelled) return;
        setVehicles(vehicleList);
        setLogs(logList);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, date]);

  if (loadError) return <ErrorBanner message={loadError} />;
  if (logs === null) return <Spinner full />;

  const findLog = (id) => (id && logs.find((l) => l.vehicleId?._id === id)) || null;
  const editingLog = findLog(vehicleId);

  // A saved entry's vehicle stays pickable even if it has since been
  // deactivated, so the entry can always be reopened.
  const known = new Set(vehicles.map((v) => v._id));
  const vehicleOptions = [...vehicles, ...logs.map((l) => l.vehicleId).filter((v) => v && !known.has(v._id))];
  const pendingVehicles = vehicles.filter((v) => !findLog(v._id));

  // Landing on a saved entry loads it; leaving one starts blank; moving
  // between two unsaved vehicles keeps what's been typed.
  const selectVehicle = (id) => {
    const nextLog = findLog(id);
    if (nextLog) setFields(fieldsFromLog(nextLog));
    else if (editingLog) setFields(emptyFields);
    setVehicleId(id);
    setError('');
    setNotice('');
  };

  const resetForm = () => {
    setVehicleId('');
    setFields(emptyFields);
    setError('');
  };

  const setField = (key) => (value) => setFields((f) => ({ ...f, [key]: value }));
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSave = async () => {
    if (NUMERIC_KEYS.every((k) => fields[k] === '')) {
      setError('Enter Fuel Issued, or at least one reading.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { date, vehicleId, remark: fields.remark.trim() };
      NUMERIC_KEYS.forEach((key) => {
        payload[key] = fields[key];
      });
      const saved = await fuelApi.upsertFuelLog(projectId, payload);
      setLogs((prev) => (prev.some((l) => l._id === saved._id) ? prev.map((l) => (l._id === saved._id ? saved : l)) : [...prev, saved]));
      setNotice(`${editingLog ? 'Updated' : 'Saved'}: ${saved.vehicleId?.name || 'Vehicle'}`);
      resetForm();
      scrollToForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (log) => {
    if (!window.confirm(`Delete the fuel entry for ${log.vehicleId?.name || 'this vehicle'}? The vehicle itself is kept.`)) return;
    setError('');
    setNotice('');
    try {
      await fuelApi.deleteFuelLog(projectId, log._id);
      setLogs((prev) => prev.filter((l) => l._id !== log._id));
      if (editingLog?._id === log._id) resetForm();
    } catch (err) {
      setError(err.message);
      scrollToForm();
    }
  };

  const totalIssued = logs.reduce((sum, l) => sum + (l.fuelIssued || 0), 0);

  return (
    <div className="space-y-6">
      <section ref={formRef} className="scroll-mt-28 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{editingLog ? 'Edit saved entry' : 'New entry'}</h2>
          {vehicleId && (
            <button type="button" className="text-sm text-slate-500 underline" onClick={resetForm}>
              Clear
            </button>
          )}
        </div>

        {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">✓ {notice}</p>}

        <PickOrAdd
          label="Vehicle"
          options={vehicleOptions}
          value={vehicleId}
          onChange={selectVehicle}
          onCreate={async (name) => {
            const vehicle = await mastersApi.createVehicle(projectId, { name, category: 'other' });
            setVehicles((v) => [...v, vehicle]);
            return vehicle;
          }}
        />

        {!vehicleId && <p className="text-sm text-slate-500">Pick a vehicle to enter its fuel.</p>}

        {vehicleId && (
          <>
            <NumberField label="Fuel Issued (litres)" value={fields.fuelIssued} onChange={setField('fuelIssued')} />

            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Opening KM (optional)" value={fields.openingKm} onChange={setField('openingKm')} />
              <NumberField label="Closing KM (optional)" value={fields.closingKm} onChange={setField('closingKm')} />
              <NumberField label="Opening Fuel (optional)" value={fields.openingFuel} onChange={setField('openingFuel')} />
              <NumberField label="Closing Fuel (optional)" value={fields.closingFuel} onChange={setField('closingFuel')} />
            </div>

            <Field label="Remarks (optional)">
              <input className={inputClass()} value={fields.remark} onChange={(e) => setField('remark')(e.target.value)} />
            </Field>
          </>
        )}

        <ErrorBanner message={error} />

        {vehicleId && (
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editingLog ? 'Update entry' : 'Save entry'}
          </Button>
        )}
      </section>

      {pendingVehicles.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-600">Not entered yet ({pendingVehicles.length})</h2>
          <div className="flex flex-wrap gap-2">
            {pendingVehicles.map((v) => (
              <button
                key={v._id}
                type="button"
                onClick={() => {
                  selectVehicle(v._id);
                  scrollToForm();
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-brand-300"
              >
                {v.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-600">
          Saved for this date ({logs.length}){logs.length > 0 && ` · ${totalIssued} L issued`}
        </h2>

        {logs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Nothing saved for this date yet.
          </p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log._id}
                className={`flex items-start justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm ${
                  editingLog?._id === log._id ? 'border-brand-500' : 'border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{log.vehicleId?.name || 'Vehicle'}</div>
                  <div className="text-sm text-slate-500">
                    {[
                      log.fuelIssued != null && `${log.fuelIssued} L issued`,
                      log.dieselConsumed != null && `${log.dieselConsumed} L consumed`,
                      log.fuelPerKm != null && `${log.fuelPerKm} L/KM`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Readings only'}
                  </div>
                  {log.remark && <div className="mt-1 text-sm text-slate-500">“{log.remark}”</div>}
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm font-medium">
                  <button
                    type="button"
                    className="text-brand-600"
                    onClick={() => {
                      selectVehicle(log.vehicleId._id);
                      scrollToForm();
                    }}
                  >
                    Edit
                  </button>
                  <button type="button" className="text-red-600" onClick={() => handleDelete(log)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
