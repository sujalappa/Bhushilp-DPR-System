import { useEffect, useState } from 'react';
import * as mastersApi from '../../api/masters';
import * as shiftCardApi from '../../api/shiftCard';
import Button from '../../components/Button';
import Field from '../../components/Field';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import PickOrAdd from '../../components/PickOrAdd';
import TimePicker12h from '../../components/TimePicker12h';
import { formatTime12h } from '../../utils/date';

// Optional per-trip records (loading/unloading time, machine, loading point)
// for one saved shift entry. Detail only: the entry's Total Trips field is
// what every calculation uses, never the number of rows here.
export default function TripDetails({ projectId, shiftLog, machines, loadingPoints, onMachineCreated, onLoadingPointCreated }) {
  const [trips, setTrips] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    shiftCardApi
      .listTrips(projectId, shiftLog._id)
      .then((list) => !cancelled && setTrips(list))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, shiftLog._id]);

  const removeTrip = async (trip) => {
    setError('');
    try {
      await shiftCardApi.deleteTrip(projectId, shiftLog._id, trip._id);
      setTrips((t) => t.filter((x) => x._id !== trip._id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <p className="text-xs text-slate-500">
        Optional. Records the time, machine and loading point of individual trips. It doesn't change Total Trips.
      </p>

      <ErrorBanner message={error} />

      {trips === null && !error && <Spinner />}

      {trips?.map((trip) => (
        <div key={trip._id} className="flex items-start justify-between rounded-lg bg-slate-50 p-3 text-sm">
          <div>
            <div className="font-medium text-slate-900">
              Trip {trip.snNo} · {formatTime12h(trip.loadingTime) || '—'} – {formatTime12h(trip.unloadingTime) || '—'}
            </div>
            <div className="text-slate-500">
              {trip.machineVehicleId?.name || 'No machine'} · {trip.loadingPointId?.name || 'No loading point'}
            </div>
          </div>
          <button type="button" className="font-medium text-red-600" onClick={() => removeTrip(trip)}>
            Delete
          </button>
        </div>
      ))}

      {trips !== null &&
        (adding ? (
          <AddTripForm
            projectId={projectId}
            shiftLog={shiftLog}
            machines={machines}
            loadingPoints={loadingPoints}
            onMachineCreated={onMachineCreated}
            onLoadingPointCreated={onLoadingPointCreated}
            onAdded={(trip) => setTrips((t) => [...t, trip])}
            onClose={() => setAdding(false)}
          />
        ) : (
          <Button type="button" variant="secondary" className="w-full" onClick={() => setAdding(true)}>
            + Add trip detail
          </Button>
        ))}
    </div>
  );
}

function AddTripForm({ projectId, shiftLog, machines, loadingPoints, onMachineCreated, onLoadingPointCreated, onAdded, onClose }) {
  const [loadingTime, setLoadingTime] = useState('');
  const [unloadingTime, setUnloadingTime] = useState('');
  const [machineVehicleId, setMachineVehicleId] = useState('');
  const [loadingPointId, setLoadingPointId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      // Machine and loading point usually repeat trip after trip, so only
      // the times are cleared for the next one.
      setLoadingTime('');
      setUnloadingTime('');
      if (!keepOpen) onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
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
          onMachineCreated(machine);
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
          onLoadingPointCreated(point);
          return point;
        }}
      />

      <ErrorBanner message={error} />

      <div className="flex flex-wrap gap-2">
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
