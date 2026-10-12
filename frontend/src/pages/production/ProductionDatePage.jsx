import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as productionApi from '../../api/production';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import DateShiftPicker from '../../components/DateShiftPicker';

// No vehicle/driver drill-down here — Daily Production is one combined,
// site-wide figure per shift from the supervisor/project manager (per the
// workbook's Read Me sheet), so the form sits directly inside the shared
// date/shift picker instead of a further navigation step.
export default function ProductionDatePage() {
  const { projectId } = useParams();

  return (
    <AppShell title="Daily Production" backTo={`/projects/${projectId}`}>
      <DateShiftPicker projectId={projectId}>
        {(date, shift) => <ProductionForm projectId={projectId} date={date} shift={shift} />}
      </DateShiftPicker>
    </AppShell>
  );
}

const emptyForm = { hardOB: 0, target: 0, remark: '' };

function ProductionForm({ projectId, date, shift }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [computed, setComputed] = useState({ obRehandling: 0, totalCum: 0, achievementPct: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLocked(false);
    productionApi
      .getProduction(projectId, date, shift)
      .then((d) => {
        if (cancelled) return;
        setForm({
          hardOB: d.hardOB ?? 0,
          target: d.target ?? 0,
          remark: d.remark || '',
        });
        setComputed({ obRehandling: d.obRehandling, totalCum: d.totalCum, achievementPct: d.achievementPct });
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, date, shift]);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        date,
        shift,
        hardOB: form.hardOB === '' ? 0 : Number(form.hardOB),
        target: form.target === '' ? undefined : Number(form.target),
        remark: form.remark || undefined,
      };
      const saved = await productionApi.upsertProduction(projectId, payload);
      setComputed({ obRehandling: saved.obRehandling, totalCum: saved.totalCum, achievementPct: saved.achievementPct });
      setLocked(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner full />;

  if (locked) {
    return (
      <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-semibold text-green-700">✓ Saved</p>
        <p className="text-sm text-slate-600">
          Total Cum: {computed.totalCum}
          {computed.achievementPct !== null && <> · Achievement: {computed.achievementPct}%</>}
        </p>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={() => setLocked(false)}>
            Edit
          </Button>
          <Button className="flex-1" onClick={() => navigate(`/projects/${projectId}`)}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Hard OB" value={form.hardOB} onChange={(hardOB) => update({ hardOB })} />
        <Field label="Soft OB" hint="Not in use yet — rehandling formula will move here later">
          <input type="number" className={`${inputClass()} bg-slate-100 text-slate-400`} value={0} disabled readOnly />
        </Field>
        <Field label="OB Rehandling" hint="Auto: 14 x trips logged this shift">
          <input
            type="number"
            className={`${inputClass()} bg-slate-100 text-slate-400`}
            value={computed.obRehandling ?? 0}
            disabled
            readOnly
          />
        </Field>
        <NumberField label="Target (optional)" value={form.target} onChange={(target) => update({ target })} />
      </div>

      <p className="text-sm text-slate-500">
        Total Cum: {computed.totalCum}
        {computed.achievementPct !== null && <> · Achievement: {computed.achievementPct}%</>}
      </p>

      <Field label="Remarks (optional)" hint='e.g. "Production hampered 8am–2pm due to bad road condition"'>
        <input className={inputClass()} value={form.remark} onChange={(e) => update({ remark: e.target.value })} />
      </Field>

      <ErrorBanner message={error} />

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
