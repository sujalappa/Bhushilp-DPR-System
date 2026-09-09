import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as mastersApi from '../../api/masters';
import * as fuelApi from '../../api/fuel';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import { todayIso } from '../../utils/date';

// No shift here — the real data showed fuel is issued once a day per
// vehicle, never tied to a shift (see FuelLog model) — so this is just
// Date -> vehicle list, one level shallower than the shift card. Every
// vehicle shows up here, including excavators/dozers, since fuel applies
// to all equipment, not just haulers.
export default function FuelDatePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIso());
  const [vehicles, setVehicles] = useState(null);
  const [logsByVehicle, setLogsByVehicle] = useState({});
  const [error, setError] = useState('');
  const [addingVehicle, setAddingVehicle] = useState(false);

  const load = () => {
    Promise.all([mastersApi.listVehicles(projectId, { active: true }), fuelApi.listFuelLogs(projectId, date)])
      .then(([vehicleList, logs]) => {
        setVehicles(vehicleList);
        const map = {};
        logs.forEach((l) => {
          map[l.vehicleId._id] = l;
        });
        setLogsByVehicle(map);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [projectId, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const openVehicle = (vehicleId) => navigate(`/projects/${projectId}/fuel/${date}/${vehicleId}`);

  return (
    <AppShell title="Fuel Consumption" backTo={`/projects/${projectId}`}>
      <Field label="Date">
        <input
          type="date"
          max={todayIso()}
          className={inputClass()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <ErrorBanner message={error} />

      {vehicles === null ? (
        <Spinner full />
      ) : (
        <div className="mt-4 space-y-2">
          {vehicles.map((v) => {
            const log = logsByVehicle[v._id];
            return (
              <button
                key={v._id}
                onClick={() => openVehicle(v._id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-300"
              >
                <span className="font-medium text-slate-900">{v.name}</span>
                {log?.fuelIssued != null ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    {log.fuelIssued} L issued
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    Not logged
                  </span>
                )}
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
          placeholder="Vehicle name"
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
