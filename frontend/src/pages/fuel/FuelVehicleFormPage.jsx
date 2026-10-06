import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as mastersApi from '../../api/masters';
import * as fuelApi from '../../api/fuel';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';

const emptyForm = { openingKm: '', closingKm: '', openingFuel: '', fuelIssued: '', closingFuel: '', remark: '' };

export default function FuelVehicleFormPage() {
  const { projectId, date, vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [computed, setComputed] = useState({ dieselConsumed: null, fuelPerKm: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLocked(false);
    Promise.all([mastersApi.listVehicles(projectId, { active: true }), fuelApi.listFuelLogs(projectId, date)])
      .then(([vehicles, logs]) => {
        if (cancelled) return;
        setVehicle(vehicles.find((v) => v._id === vehicleId) || null);
        const existing = logs.find((l) => l.vehicleId._id === vehicleId);
        if (existing) {
          setForm({
            openingKm: existing.openingKm ?? '',
            closingKm: existing.closingKm ?? '',
            openingFuel: existing.openingFuel ?? '',
            fuelIssued: existing.fuelIssued ?? '',
            closingFuel: existing.closingFuel ?? '',
            remark: existing.remark || '',
          });
          setComputed({ dieselConsumed: existing.dieselConsumed, fuelPerKm: existing.fuelPerKm });
        }
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, date, vehicleId]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        date,
        vehicleId,
        openingKm: form.openingKm === '' ? undefined : Number(form.openingKm),
        closingKm: form.closingKm === '' ? undefined : Number(form.closingKm),
        openingFuel: form.openingFuel === '' ? undefined : Number(form.openingFuel),
        fuelIssued: form.fuelIssued === '' ? undefined : Number(form.fuelIssued),
        closingFuel: form.closingFuel === '' ? undefined : Number(form.closingFuel),
        remark: form.remark || undefined,
      };
      const result = await fuelApi.upsertFuelLog(projectId, payload);
      setComputed({ dieselConsumed: result.dieselConsumed, fuelPerKm: result.fuelPerKm });
      setLocked(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppShell title="Loading…"><Spinner full /></AppShell>;

  return (
    <AppShell title={vehicle?.name || 'Vehicle'} backTo={`/projects/${projectId}/fuel`}>
      <p className="mb-4 text-sm text-slate-500">{date}</p>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        {locked ? (
          <div className="space-y-3 text-center">
            <p className="text-lg font-semibold text-green-700">✓ Saved</p>
            {(computed.dieselConsumed !== null || computed.fuelPerKm !== null) && (
              <p className="text-sm text-slate-600">
                {computed.dieselConsumed !== null && <>Diesel Consumed: {computed.dieselConsumed} L</>}
                {computed.dieselConsumed !== null && computed.fuelPerKm !== null && ' · '}
                {computed.fuelPerKm !== null && <>{computed.fuelPerKm} L/KM</>}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setLocked(false)}>
                Edit
              </Button>
              <Button className="flex-1" onClick={() => navigate(`/projects/${projectId}/fuel`)}>
                Back to Vehicles
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Fuel Issued first and on its own — it's the one field the real
                paper process actually always fills in; the rest are optional
                extras for a site that wants full reconciliation. */}
            <Field label="Fuel Issued (litres)">
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                className={inputClass()}
                value={form.fuelIssued}
                onChange={(e) => update({ fuelIssued: e.target.value })}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Opening KM (optional)">
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputClass()}
                  value={form.openingKm}
                  onChange={(e) => update({ openingKm: e.target.value })}
                />
              </Field>
              <Field label="Closing KM (optional)">
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputClass()}
                  value={form.closingKm}
                  onChange={(e) => update({ closingKm: e.target.value })}
                />
              </Field>
              <Field label="Opening Fuel (optional)">
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputClass()}
                  value={form.openingFuel}
                  onChange={(e) => update({ openingFuel: e.target.value })}
                />
              </Field>
              <Field label="Closing Fuel (optional)">
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputClass()}
                  value={form.closingFuel}
                  onChange={(e) => update({ closingFuel: e.target.value })}
                />
              </Field>
            </div>

            {(computed.dieselConsumed !== null || computed.fuelPerKm !== null) && (
              <p className="text-sm text-slate-500">
                {computed.dieselConsumed !== null && <>Diesel Consumed: {computed.dieselConsumed} L</>}
                {computed.dieselConsumed !== null && computed.fuelPerKm !== null && ' · '}
                {computed.fuelPerKm !== null && <>{computed.fuelPerKm} L/KM</>}
              </p>
            )}

            <Field label="Remarks (optional)">
              <input className={inputClass()} value={form.remark} onChange={(e) => update({ remark: e.target.value })} />
            </Field>

            <ErrorBanner message={error} />

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => navigate(`/projects/${projectId}/fuel`)}
              >
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
