import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as mastersApi from '../../api/masters';
import * as shiftCardApi from '../../api/shiftCard';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import PickOrAdd from '../../components/PickOrAdd';
import TimePicker12h from '../../components/TimePicker12h';
import { LOADING_MACHINE_CATEGORIES } from '../../utils/vehicleCategories';
import { formatTime12h } from '../../utils/date';

const emptyHeader = {
  status: 'working',
  startKm: '',
  closeKm: '',
  startHrs: '',
  closeHrs: '',
  fuelOpen: '',
  fuelClose: '',
  totalTripsManual: '',
  remark: '',
};

export default function VehicleShiftFormPage() {
  const { projectId, date, shift, vehicleId, driverId } = useParams();
  const navigate = useNavigate();
  const backToDriverSegments = () => navigate(`/projects/${projectId}/shift-card/${date}/${shift}/${vehicleId}`);
  // The URL fixes which driver-segment this page is — 'none' is the
  // sentinel for "no driver was ever assigned" (see DriverSegmentsPage).
  // There's no way to switch driver from inside this form: a driver change
  // means going back and opening/creating a different segment, which is the
  // whole point — it keeps this driver's saved data untouched.
  const isNoDriver = driverId === 'none';

  const [vehicle, setVehicle] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loadingPoints, setLoadingPoints] = useState([]);
  const [machines, setMachines] = useState([]);
  const [shiftLog, setShiftLog] = useState(null); // null until first save, or loaded from server
  const [header, setHeader] = useState(emptyHeader);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLocked(false);
    Promise.all([
      mastersApi.listVehicles(projectId, { active: true }),
      mastersApi.listDrivers(projectId, { active: true }),
      mastersApi.listLoadingPoints(projectId, { active: true }),
      shiftCardApi.listShiftLogs(projectId, date, shift),
    ])
      .then(async ([vehicles, driverList, loadingPointList, logs]) => {
        if (cancelled) return;
        setVehicle(vehicles.find((v) => v._id === vehicleId) || null);
        setDriver(isNoDriver ? null : driverList.find((d) => d._id === driverId) || null);
        setLoadingPoints(loadingPointList);
        setMachines(vehicles.filter((v) => LOADING_MACHINE_CATEGORIES.includes(v.category)));

        const existing = logs.find(
          (l) => l.vehicleId._id === vehicleId && (isNoDriver ? !l.driverId : l.driverId?._id === driverId)
        );
        if (existing) {
          setShiftLog(existing);
          setHeader({
            status: existing.status,
            startKm: existing.startKm ?? '',
            closeKm: existing.closeKm ?? '',
            startHrs: existing.startHrs ?? '',
            closeHrs: existing.closeHrs ?? '',
            fuelOpen: existing.fuelOpen ?? '',
            fuelClose: existing.fuelClose ?? '',
            totalTripsManual: existing.totalTripsManual ?? '',
            remark: existing.remark || '',
          });
          const tripList = await shiftCardApi.listTrips(projectId, existing._id);
          if (!cancelled) setTrips(tripList);
        } else {
          // Fresh segment: a "no driver" entry can only ever be non-working.
          setHeader({ ...emptyHeader, status: isNoDriver ? 'non-working' : 'working' });
        }
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, date, shift, vehicleId, driverId, isNoDriver]);

  const updateHeader = (patch) => setHeader((h) => ({ ...h, ...patch }));

  const saveHeader = async () => {
    if (isNoDriver && !header.remark.trim()) {
      setError('A reason is required for a vehicle with no driver assigned.');
      return;
    }
    if (!isNoDriver && header.totalTripsManual === '') {
      setError('Total Trips is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // A real driver segment is always "working" — whether it actually
      // produced trips is just visible in the trip count, not a separate
      // flag to set. Only the "no driver assigned" segment is ever
      // non-working (there's no one who could have driven it).
      const status = isNoDriver ? 'non-working' : 'working';
      const payload = {
        date,
        shift,
        vehicleId,
        driverId: isNoDriver ? undefined : driverId,
        status,
        remark: header.remark || undefined,
      };
      if (!isNoDriver) {
        ['startKm', 'closeKm', 'startHrs', 'closeHrs', 'fuelOpen', 'fuelClose', 'totalTripsManual'].forEach((key) => {
          payload[key] = header[key] === '' ? undefined : Number(header[key]);
        });
      }
      const saved = await shiftCardApi.upsertShiftLog(projectId, payload);
      setShiftLog(saved);
      setLocked(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppShell title="Loading…"><Spinner full /></AppShell>;

  const totalKm =
    header.closeKm !== '' && header.startKm !== '' ? Number(header.closeKm) - Number(header.startKm) : null;
  const totalHrs =
    header.closeHrs !== '' && header.startHrs !== '' ? Number(header.closeHrs) - Number(header.startHrs) : null;
  // The number that drives every calculation — never the count of
  // individually logged trips below, which are detail records only.
  const totalTrips = header.totalTripsManual === '' ? 0 : Number(header.totalTripsManual);

  return (
    <AppShell
      title={vehicle?.name || 'Vehicle'}
      backTo={`/projects/${projectId}/shift-card/${date}/${shift}/${vehicleId}`}
    >
      <p className="mb-4 text-sm text-slate-500">
        {date} — Shift {shift} · Driver: {isNoDriver ? 'None assigned' : driver?.name || '…'}
        {!isNoDriver && <> · Total Trips: {totalTrips}</>}
      </p>

      <ErrorBanner message={error} />

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        {locked ? (
          <div className="space-y-3 text-center">
            <p className="text-lg font-semibold text-green-700">✓ Saved</p>
            {!isNoDriver && (
              <p className="text-sm text-slate-600">
                {totalKm !== null && <>Total: {totalKm} KM</>}
                {totalKm !== null && totalHrs !== null && ' · '}
                {totalHrs !== null && <>{totalHrs} Hrs</>}
                {(totalKm !== null || totalHrs !== null) && ' · '}
                {totalTrips} Trip{totalTrips === 1 ? '' : 's'}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setLocked(false)}>
                Edit
              </Button>
              <Button className="flex-1" onClick={backToDriverSegments}>
                Back to Drivers
              </Button>
            </div>
          </div>
        ) : (
          <>
            {isNoDriver ? (
              // A "no driver" segment can only ever be non-working — there's no
              // one to have driven it.
              <Field label="Reason this vehicle had no driver" hint='e.g. "Spare vehicle, not needed this shift"'>
                <input
                  autoFocus
                  className={inputClass()}
                  value={header.remark}
                  onChange={(e) => updateHeader({ remark: e.target.value })}
                />
              </Field>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Starting KM">
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputClass()}
                      value={header.startKm}
                      onChange={(e) => updateHeader({ startKm: e.target.value })}
                    />
                  </Field>
                  <Field label="Closing KM">
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputClass()}
                      value={header.closeKm}
                      onChange={(e) => updateHeader({ closeKm: e.target.value })}
                    />
                  </Field>
                  <Field label="Starting Hrs">
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputClass()}
                      value={header.startHrs}
                      onChange={(e) => updateHeader({ startHrs: e.target.value })}
                    />
                  </Field>
                  <Field label="Closing Hrs">
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputClass()}
                      value={header.closeHrs}
                      onChange={(e) => updateHeader({ closeHrs: e.target.value })}
                    />
                  </Field>
                  <Field label="Fuel Open">
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputClass()}
                      value={header.fuelOpen}
                      onChange={(e) => updateHeader({ fuelOpen: e.target.value })}
                    />
                  </Field>
                  <Field label="Fuel Close">
                    <input
                      type="number"
                      inputMode="decimal"
                      className={inputClass()}
                      value={header.fuelClose}
                      onChange={(e) => updateHeader({ fuelClose: e.target.value })}
                    />
                  </Field>
                </div>

                {(totalKm !== null || totalHrs !== null) && (
                  <p className="text-sm text-slate-500">
                    {totalKm !== null && <>Total: {totalKm} KM</>}
                    {totalKm !== null && totalHrs !== null && ' · '}
                    {totalHrs !== null && <>{totalHrs} Hrs</>}
                  </p>
                )}

                <Field
                  label="Total Trips"
                  hint="This is the number every calculation uses. Trips added individually below are just detail records (loading/unloading time, machine) and don't affect this count."
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    required
                    autoFocus
                    className={inputClass()}
                    value={header.totalTripsManual}
                    onChange={(e) => updateHeader({ totalTripsManual: e.target.value })}
                  />
                </Field>

                <Field label="Remark (optional)" hint='e.g. "Breakdown at 10am, no more trips after"'>
                  <input
                    className={inputClass()}
                    value={header.remark}
                    onChange={(e) => updateHeader({ remark: e.target.value })}
                  />
                </Field>
              </>
            )}

            <Button className="w-full" onClick={saveHeader} disabled={saving}>
              {saving ? 'Saving…' : shiftLog ? 'Update' : 'Save'}
            </Button>
          </>
        )}
      </div>

      {shiftLog && shiftLog.status === 'working' && (
        <TripsSection
          projectId={projectId}
          shiftLog={shiftLog}
          trips={trips}
          setTrips={setTrips}
          machines={machines}
          setMachines={setMachines}
          loadingPoints={loadingPoints}
          setLoadingPoints={setLoadingPoints}
          onDone={backToDriverSegments}
        />
      )}
    </AppShell>
  );
}

function TripsSection({ projectId, shiftLog, trips, setTrips, machines, setMachines, loadingPoints, setLoadingPoints, onDone }) {
  const [addingTrip, setAddingTrip] = useState(false);

  return (
    <div className="mt-6">
      <div className="mb-2">
        <h2 className="font-medium text-slate-900">Trip details ({trips.length})</h2>
        <p className="text-xs text-slate-500">
          Optional — for recording loading/unloading time, machine and loading point per trip. Doesn't change the
          Total Trips count above.
        </p>
      </div>

      <div className="space-y-2">
        {trips.map((trip) => (
          <div key={trip._id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{trip.snNo}</span>
              <button
                className="text-red-600"
                onClick={async () => {
                  await shiftCardApi.deleteTrip(projectId, shiftLog._id, trip._id);
                  setTrips((t) => t.filter((x) => x._id !== trip._id));
                }}
              >
                Delete
              </button>
            </div>
            <div className="mt-1 text-slate-600">
              {formatTime12h(trip.loadingTime) || '—'} – {formatTime12h(trip.unloadingTime) || '—'}
            </div>
            <div className="text-slate-500">
              {trip.machineVehicleId?.name || 'No machine'} · {trip.loadingPointId?.name || 'No loading point'}
            </div>
          </div>
        ))}
      </div>

      {!addingTrip ? (
        <Button variant="accent" className="mt-3 w-full" onClick={() => setAddingTrip(true)}>
          + Add Trip
        </Button>
      ) : (
        <AddTripForm
          projectId={projectId}
          shiftLog={shiftLog}
          machines={machines}
          setMachines={setMachines}
          loadingPoints={loadingPoints}
          setLoadingPoints={setLoadingPoints}
          onAdded={(trip) => setTrips((t) => [...t, trip])}
          onClose={() => setAddingTrip(false)}
        />
      )}

      {/* Once all trips for this driver are logged, one tap back to the
          driver list — instead of the back arrow, which only goes up one
          screen at a time. */}
      <Button variant="secondary" className="mt-4 w-full" onClick={onDone}>
        Done — back to drivers
      </Button>
    </div>
  );
}

function AddTripForm({ projectId, shiftLog, machines, setMachines, loadingPoints, setLoadingPoints, onAdded, onClose }) {
  const [loadingTime, setLoadingTime] = useState('');
  const [unloadingTime, setUnloadingTime] = useState('');
  const [machineVehicleId, setMachineVehicleId] = useState('');
  const [loadingPointId, setLoadingPointId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setLoadingTime('');
    setUnloadingTime('');
    setMachineVehicleId('');
    setLoadingPointId('');
  };

  const handleSave = async (keepOpen) => {
    setSaving(true);
    setError('');
    try {
      const trip = await shiftCardApi.addTrip(projectId, shiftLog._id, {
        loadingTime: loadingTime || undefined,
        unloadingTime: unloadingTime || undefined,
        machineVehicleId: machineVehicleId || undefined,
        loadingPointId: loadingPointId || undefined,
      });
      onAdded(trip);
      reset();
      if (!keepOpen) onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <Field label="Loading time">
        <TimePicker12h value={loadingTime} onChange={setLoadingTime} />
      </Field>
      <Field label="Unloading time">
        <TimePicker12h value={unloadingTime} onChange={setUnloadingTime} />
      </Field>

      <PickOrAdd
        label="Machine no."
        options={machines}
        value={machineVehicleId}
        onChange={setMachineVehicleId}
        onCreate={async (name) => {
          const machine = await mastersApi.createVehicle(projectId, { name, category: 'excavator' });
          setMachines((m) => [...m, machine]);
          return machine;
        }}
      />

      <PickOrAdd
        label="Loading point"
        options={loadingPoints}
        value={loadingPointId}
        onChange={setLoadingPointId}
        onCreate={async (name) => {
          const point = await mastersApi.createLoadingPoint(projectId, { name });
          setLoadingPoints((p) => [...p, point]);
          return point;
        }}
      />

      <ErrorBanner message={error} />

      <div className="flex gap-2">
        <Button type="button" onClick={() => handleSave(true)} disabled={saving}>
          {saving ? 'Saving…' : 'Save & add another'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
          Save & close
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
