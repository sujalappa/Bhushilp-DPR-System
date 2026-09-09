import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as mastersApi from '../../api/masters';
import * as shiftCardApi from '../../api/shiftCard';
import AppShell from '../../components/AppShell';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import Button from '../../components/Button';
import { inputClass } from '../../components/Field';
import { LOADING_MACHINE_CATEGORIES } from '../../utils/vehicleCategories';

const STATUS_STYLES = {
  working: 'bg-green-100 text-green-700',
  'non-working': 'bg-amber-100 text-amber-700',
  'not-started': 'bg-slate-100 text-slate-500',
};

// A vehicle can now have more than one segment this shift (one per driver,
// see DriverSegmentsPage) — summarize them into a single badge for the list.
function summarize(segments) {
  if (!segments || segments.length === 0) return { key: 'not-started', label: 'Not started' };
  const workingCount = segments.filter((s) => s.status === 'working').length;
  if (workingCount === 0) return { key: 'non-working', label: 'Non-working' };
  return { key: 'working', label: workingCount > 1 ? `Working (${workingCount} drivers)` : 'Working' };
}

export default function ShiftVehiclesPage() {
  const { projectId, date, shift } = useParams();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState(null);
  const [segmentsByVehicle, setSegmentsByVehicle] = useState({});
  const [error, setError] = useState('');
  const [addingVehicle, setAddingVehicle] = useState(false);

  const load = () => {
    Promise.all([
      mastersApi.listVehicles(projectId, { active: true }),
      shiftCardApi.listShiftLogs(projectId, date, shift),
    ])
      .then(([vehicleList, logs]) => {
        // Excavators/loaders/dozers only ever appear in the "Machine no."
        // dropdown on a trip — they don't get their own shift-card entry.
        setVehicles(vehicleList.filter((v) => !LOADING_MACHINE_CATEGORIES.includes(v.category)));
        const map = {};
        logs.forEach((log) => {
          const vId = log.vehicleId._id;
          (map[vId] ||= []).push(log);
        });
        setSegmentsByVehicle(map);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [projectId, date, shift]);

  const openVehicle = (vehicleId) =>
    navigate(`/projects/${projectId}/shift-card/${date}/${shift}/${vehicleId}`);

  return (
    <AppShell title={`Shift ${shift} — ${date}`} backTo={`/projects/${projectId}/shift-card`}>
      <ErrorBanner message={error} />

      {vehicles === null ? (
        <Spinner full />
      ) : (
        <div className="space-y-2">
          {vehicles.map((v) => {
            const { key, label } = summarize(segmentsByVehicle[v._id]);
            return (
              <button
                key={v._id}
                onClick={() => openVehicle(v._id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-300"
              >
                <span className="font-medium text-slate-900">{v.name}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[key]}`}>{label}</span>
              </button>
            );
          })}

          {vehicles.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
              No vehicles yet — add the first one below.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        {!addingVehicle ? (
          <button className="text-sm font-medium text-brand-600" onClick={() => setAddingVehicle(true)}>
            + Add a vehicle not in the list
          </button>
        ) : (
          <AddVehicleInline
            projectId={projectId}
            onAdded={(vehicle) => openVehicle(vehicle._id)}
            onCancel={() => setAddingVehicle(false)}
          />
        )}
      </div>
    </AppShell>
  );
}

function AddVehicleInline({ projectId, onAdded, onCancel }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const vehicle = await mastersApi.createVehicle(projectId, { name: name.trim(), category: 'other' });
      onAdded(vehicle);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          autoFocus
          className={inputClass()}
          placeholder="Vehicle name (e.g. Tipper 6580)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="button" onClick={handleAdd} disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
