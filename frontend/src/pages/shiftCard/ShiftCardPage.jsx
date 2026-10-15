import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as mastersApi from '../../api/masters';
import * as shiftCardApi from '../../api/shiftCard';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import PickOrAdd from '../../components/PickOrAdd';
import DateShiftPicker from '../../components/DateShiftPicker';
import TripDetails from './TripDetails';
import { LOADING_MACHINE_CATEGORIES } from '../../utils/vehicleCategories';
import { withReferenced, upsertById } from '../../utils/options';
import { shiftLabel, entryCount } from '../../utils/shift';
import { HANDLING_TYPES, handlingOf } from '../../utils/obFactors';

// The whole shift card on one page: date + shift at the top (shared
// picker), one entry form, and the list of what's already saved for that
// shift underneath. An "entry" is one driver's time on one vehicle — the
// backend keys it on (date, shift, vehicle, driver) — so picking a vehicle
// and driver that already have one loads it for editing, and a mid-shift
// driver change is just a second entry for the same vehicle.
export default function ShiftCardPage() {
  const { projectId } = useParams();

  return (
    <AppShell title="Shift Card" backTo={`/projects/${projectId}`}>
      <DateShiftPicker projectId={projectId}>
        {(date, shift) => (
          // Keyed so switching date or shift starts from a clean form
          // instead of carrying half-typed values across.
          <ShiftEntries key={`${date}|${shift}`} projectId={projectId} date={date} shift={shift} />
        )}
      </DateShiftPicker>
    </AppShell>
  );
}

const NUMERIC_KEYS = ['startKm', 'closeKm', 'startHrs', 'closeHrs', 'fuelOpen', 'fuelClose', 'totalTripsManual'];
const emptyFields = {
  ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, ''])),
  handlingType: HANDLING_TYPES[0].value,
  remark: '',
};
const emptySelection = { vehicleId: '', driverId: '', noDriver: false };

const fieldsFromLog = (log) => ({
  ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, log[k] ?? ''])),
  handlingType: log.handlingType || HANDLING_TYPES[0].value,
  remark: log.remark || '',
});

// Blank goes up as null (not omitted) so clearing a previously saved value
// actually clears it.
const toNumberOrNull = (v) => (v === '' ? null : Number(v));
const difference = (start, close) => (start !== '' && close !== '' ? Number(close) - Number(start) : null);

function describe(log) {
  return `${log.vehicleId?.name || 'Vehicle'} · ${log.driverId?.name || 'No driver'}`;
}

function ShiftEntries({ projectId, date, shift }) {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loadingPoints, setLoadingPoints] = useState([]);
  const [logs, setLogs] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [selection, setSelection] = useState(emptySelection);
  const [fields, setFields] = useState(emptyFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openTripsId, setOpenTripsId] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      mastersApi.listVehicles(projectId, { active: true }),
      mastersApi.listDrivers(projectId, { active: true }),
      mastersApi.listLoadingPoints(projectId, { active: true }),
      shiftCardApi.listShiftLogs(projectId, date, shift),
    ])
      .then(([vehicleList, driverList, loadingPointList, logList]) => {
        if (cancelled) return;
        setVehicles(vehicleList);
        setDrivers(driverList);
        setLoadingPoints(loadingPointList);
        setLogs(logList);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, date, shift]);

  if (loadError) return <ErrorBanner message={loadError} />;
  if (logs === null) return <Spinner full />;

  // Excavators/loaders/dozers only ever appear as the "Machine no." on a
  // trip detail — they don't get their own shift-card entry.
  const isMachine = (v) => LOADING_MACHINE_CATEGORIES.includes(v.category);
  const machines = vehicles.filter(isMachine);
  const haulVehicles = vehicles.filter((v) => !isMachine(v));
  const vehicleOptions = withReferenced(haulVehicles, logs.map((l) => l.vehicleId));
  const driverOptions = withReferenced(drivers, logs.map((l) => l.driverId));
  const pendingVehicles = haulVehicles.filter((v) => !logs.some((l) => l.vehicleId?._id === v._id));

  const findLog = (s) => {
    if (!s.vehicleId || (!s.noDriver && !s.driverId)) return null;
    return (
      logs.find(
        (l) => l.vehicleId?._id === s.vehicleId && (s.noDriver ? !l.driverId : l.driverId?._id === s.driverId)
      ) || null
    );
  };

  const editingLog = findLog(selection);
  const ready = Boolean(selection.vehicleId && (selection.noDriver || selection.driverId));

  // Changing vehicle/driver either lands on a saved entry (load it), leaves
  // one (start blank), or moves between two unsaved combinations — in which
  // case whatever has been typed is kept, so correcting a mis-picked driver
  // doesn't wipe the numbers.
  const select = (patch) => {
    const next = { ...selection, ...patch };
    const nextLog = findLog(next);
    if (nextLog) setFields(fieldsFromLog(nextLog));
    else if (editingLog) setFields(emptyFields);
    setSelection(next);
    setError('');
    setNotice('');
  };

  const resetForm = () => {
    setSelection(emptySelection);
    setFields(emptyFields);
    setError('');
  };

  const setField = (key) => (value) => {
    setFields((f) => ({ ...f, [key]: value }));
    setError('');
  };

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const totalKm = difference(fields.startKm, fields.closeKm);
  const totalHrs = difference(fields.startHrs, fields.closeHrs);

  const handleSave = async () => {
    if (selection.noDriver && !fields.remark.trim()) {
      setError('Enter the reason this vehicle had no driver.');
      return;
    }
    if (!selection.noDriver && fields.totalTripsManual === '') {
      setError('Total Trips is required.');
      return;
    }
    if (!selection.noDriver && (totalKm < 0 || totalHrs < 0)) {
      setError(totalKm < 0 ? "Closing KM can't be less than Starting KM." : "Closing Hrs can't be less than Starting Hrs.");
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        date,
        shift,
        vehicleId: selection.vehicleId,
        // A vehicle with no driver can't have run, so it's the one kind of
        // entry that is non-working; any entry with a driver is working.
        driverId: selection.noDriver ? undefined : selection.driverId,
        status: selection.noDriver ? 'non-working' : 'working',
        remark: fields.remark.trim(),
      };
      if (!selection.noDriver) {
        NUMERIC_KEYS.forEach((key) => {
          payload[key] = toNumberOrNull(fields[key]);
        });
        payload.handlingType = fields.handlingType;
      }

      const saved = await shiftCardApi.upsertShiftLog(projectId, payload);
      setLogs((prev) => upsertById(prev, saved));
      setNotice(`${editingLog ? 'Updated' : 'Saved'}: ${describe(saved)}`);
      // Date and shift stay; vehicle and driver clear, ready for the next card.
      resetForm();
      scrollToForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (log) => {
    select({ vehicleId: log.vehicleId._id, driverId: log.driverId?._id || '', noDriver: !log.driverId });
    scrollToForm();
  };

  const handleDelete = async (log) => {
    const ok = window.confirm(
      `Delete the entry for ${describe(log)}? Its trip details are removed too. The vehicle and driver themselves are kept.`
    );
    if (!ok) return;
    setError('');
    setNotice('');
    try {
      await shiftCardApi.deleteShiftLog(projectId, log._id);
      setLogs((prev) => prev.filter((l) => l._id !== log._id));
      if (editingLog?._id === log._id) resetForm();
      if (openTripsId === log._id) setOpenTripsId(null);
    } catch (err) {
      setError(err.message);
      scrollToForm();
    }
  };

  const shiftTrips = logs.reduce((sum, l) => sum + (l.status === 'working' ? l.totalTripsManual || 0 : 0), 0);
  const handling = handlingOf(fields.handlingType);

  return (
    <div className="space-y-6">
      <section ref={formRef} className="scroll-mt-28 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{editingLog ? 'Edit saved entry' : 'New entry'}</h2>
          {(selection.vehicleId || selection.driverId || selection.noDriver) && (
            <button type="button" className="text-sm text-slate-500 underline" onClick={resetForm}>
              Clear
            </button>
          )}
        </div>

        {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">✓ {notice}</p>}

        <PickOrAdd
          label="Vehicle"
          options={vehicleOptions}
          value={selection.vehicleId}
          onChange={(vehicleId) => select({ vehicleId })}
          onCreate={async (name) => {
            const vehicle = await mastersApi.createVehicle(projectId, { name, category: 'other' });
            setVehicles((v) => [...v, vehicle]);
            return vehicle;
          }}
        />

        {!selection.noDriver && (
          <PickOrAdd
            label="Driver"
            options={driverOptions}
            value={selection.driverId}
            onChange={(driverId) => select({ driverId })}
            onCreate={async (name) => {
              const driver = await mastersApi.createDriver(projectId, { name });
              setDrivers((d) => [...d, driver]);
              return driver;
            }}
          />
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={selection.noDriver}
            onChange={(e) => select({ noDriver: e.target.checked, driverId: '' })}
          />
          This vehicle had no driver this shift (it didn't run)
        </label>

        {!ready && <p className="text-sm text-slate-500">Pick a vehicle and a driver to fill in the card.</p>}

        {ready && selection.noDriver && (
          <Field label="Reason" hint='e.g. "Spare vehicle, not needed this shift"'>
            <input className={inputClass()} value={fields.remark} onChange={(e) => setField('remark')(e.target.value)} />
          </Field>
        )}

        {ready && !selection.noDriver && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Starting KM" value={fields.startKm} onChange={setField('startKm')} />
              <NumberField label="Closing KM" value={fields.closeKm} onChange={setField('closeKm')} />
              <NumberField label="Starting Hrs" value={fields.startHrs} onChange={setField('startHrs')} />
              <NumberField label="Closing Hrs" value={fields.closeHrs} onChange={setField('closeHrs')} />
              <NumberField label="Fuel Issued" value={fields.fuelOpen} onChange={setField('fuelOpen')} />
              <NumberField label="Fuel Issued KM" value={fields.fuelClose} onChange={setField('fuelClose')} />
            </div>

            {(totalKm !== null || totalHrs !== null) && (
              <p className="text-sm text-slate-500">
                Total: {[totalKm !== null && `${totalKm} KM`, totalHrs !== null && `${totalHrs} Hrs`].filter(Boolean).join(' · ')}
              </p>
            )}
            {totalKm < 0 && <p className="text-sm text-red-600">Closing KM can&apos;t be less than Starting KM.</p>}
            {totalHrs < 0 && <p className="text-sm text-red-600">Closing Hrs can&apos;t be less than Starting Hrs.</p>}

            <NumberField
              label="Total Trips"
              hint="Required. This is the number every calculation uses."
              inputMode="numeric"
              min="0"
              value={fields.totalTripsManual}
              onChange={setField('totalTripsManual')}
            />

            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Trips count as</span>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Trips count as">
                {HANDLING_TYPES.map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    role="radio"
                    aria-checked={fields.handlingType === h.value}
                    onClick={() => setField('handlingType')(h.value)}
                    className={`rounded-lg py-3 text-sm font-medium ${
                      fields.handlingType === h.value
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {fields.handlingType === h.value ? '✓ ' : ''}
                    {h.label}
                  </button>
                ))}
              </div>
              {fields.totalTripsManual !== '' && (
                <p className="mt-1 text-sm text-slate-500">
                  {fields.totalTripsManual} trips × {handling.perTrip} = {Number(fields.totalTripsManual) * handling.perTrip} m³{' '}
                  {handling.label}, added to Daily Production.
                </p>
              )}
            </div>

            <Field label="Remark (optional)" hint='e.g. "Breakdown at 10am, no more trips after"'>
              <input className={inputClass()} value={fields.remark} onChange={(e) => setField('remark')(e.target.value)} />
            </Field>
          </>
        )}

        <ErrorBanner message={error} />

        {ready && (
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
                  select({ vehicleId: v._id });
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
          Saved for {shiftLabel(shift)} · {entryCount(logs.length)}
          {logs.length > 0 && ` · ${shiftTrips} trips`}
        </h2>

        {logs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Nothing saved for this shift yet.
          </p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <SavedEntry
                key={log._id}
                log={log}
                active={editingLog?._id === log._id}
                tripsOpen={openTripsId === log._id}
                onToggleTrips={() => setOpenTripsId(openTripsId === log._id ? null : log._id)}
                onEdit={() => handleEdit(log)}
                onDelete={() => handleDelete(log)}
              >
                <TripDetails
                  projectId={projectId}
                  shiftLog={log}
                  machines={machines}
                  loadingPoints={loadingPoints}
                  onMachineCreated={(machine) => setVehicles((v) => [...v, machine])}
                  onLoadingPointCreated={(point) => setLoadingPoints((p) => [...p, point])}
                />
              </SavedEntry>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SavedEntry({ log, active, tripsOpen, onToggleTrips, onEdit, onDelete, children }) {
  const working = log.status === 'working';
  const km = log.startKm != null && log.closeKm != null ? log.closeKm - log.startKm : null;
  const hrs = log.startHrs != null && log.closeHrs != null ? log.closeHrs - log.startHrs : null;
  const summary = working
    ? [
        `${log.totalTripsManual ?? 0} trips`,
        `${(log.totalTripsManual ?? 0) * handlingOf(log.handlingType).perTrip} m³ ${handlingOf(log.handlingType).label}`,
        km !== null && `${km} KM`,
        hrs !== null && `${hrs} Hrs`,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Did not run';

  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${active ? 'border-brand-500' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-slate-900">{describe(log)}</div>
          <div className="text-sm text-slate-500">{summary}</div>
          {log.remark && <div className="mt-1 text-sm text-slate-500">“{log.remark}”</div>}
        </div>
        <div className="flex shrink-0 items-center gap-4 text-sm font-medium">
          <button type="button" className="text-brand-600" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="text-red-600" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      {working && (
        <>
          <button type="button" className="mt-2 text-sm text-slate-500 underline" onClick={onToggleTrips}>
            {tripsOpen ? 'Hide trip details' : 'Trip details (optional)'}
          </button>
          {tripsOpen && children}
        </>
      )}
    </div>
  );
}
