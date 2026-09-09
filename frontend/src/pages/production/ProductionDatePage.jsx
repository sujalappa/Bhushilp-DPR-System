import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as productionApi from '../../api/production';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
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

const emptyForm = { hardOB: '', softOB: '', obRehandling: '', target: '', remark: '' };

function ProductionForm({ projectId, date, shift }) {
  const [form, setForm] = useState(emptyForm);
  const [computed, setComputed] = useState({ totalCum: 0, achievementPct: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSaved(false);
    productionApi
      .getProduction(projectId, date, shift)
      .then((d) => {
        if (cancelled) return;
        setForm({
          hardOB: d.hardOB ?? '',
          softOB: d.softOB ?? '',
          obRehandling: d.obRehandling ?? '',
          target: d.target ?? '',
          remark: d.remark || '',
        });
        setComputed({ totalCum: d.totalCum, achievementPct: d.achievementPct });
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
    setSaved(false);
    try {
      const payload = {
        date,
        shift,
        hardOB: form.hardOB === '' ? undefined : Number(form.hardOB),
        softOB: form.softOB === '' ? undefined : Number(form.softOB),
        obRehandling: form.obRehandling === '' ? undefined : Number(form.obRehandling),
        target: form.target === '' ? undefined : Number(form.target),
        remark: form.remark || undefined,
      };
      const saved = await productionApi.upsertProduction(projectId, payload);
      setComputed({ totalCum: saved.totalCum, achievementPct: saved.achievementPct });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner full />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hard OB">
          <input
            type="number"
            inputMode="decimal"
            className={inputClass()}
            value={form.hardOB}
            onChange={(e) => update({ hardOB: e.target.value })}
          />
        </Field>
        <Field label="Soft OB">
          <input
            type="number"
            inputMode="decimal"
            className={inputClass()}
            value={form.softOB}
            onChange={(e) => update({ softOB: e.target.value })}
          />
        </Field>
        <Field label="OB Rehandling">
          <input
            type="number"
            inputMode="decimal"
            className={inputClass()}
            value={form.obRehandling}
            onChange={(e) => update({ obRehandling: e.target.value })}
          />
        </Field>
        <Field label="Target (optional)">
          <input
            type="number"
            inputMode="decimal"
            className={inputClass()}
            value={form.target}
            onChange={(e) => update({ target: e.target.value })}
          />
        </Field>
      </div>

      <p className="text-sm text-slate-500">
        Total Cum: {computed.totalCum}
        {computed.achievementPct !== null && <> · Achievement: {computed.achievementPct}%</>}
      </p>

      <Field label="Remarks (optional)" hint='e.g. "Production hampered 8am–2pm due to bad road condition"'>
        <input className={inputClass()} value={form.remark} onChange={(e) => update({ remark: e.target.value })} />
      </Field>

      <ErrorBanner message={error} />
      {saved && <p className="text-sm text-green-700">Saved.</p>}

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
