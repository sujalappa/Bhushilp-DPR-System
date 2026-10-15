import { useState } from 'react';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import ErrorBanner from '../../components/ErrorBanner';

// Add or edit a work order: its number and the rates its labour and
// billing figures are worked out with.
export default function WorkOrderForm({ title, initial, onSubmit, onSaved, onCancel }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v == null ? '' : String(v)]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      onSaved(await onSubmit({ ...values, number: values.number.trim(), description: values.description.trim() }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      <Field label="Work order number" hint="e.g. 9100005472">
        <input
          autoFocus
          inputMode="numeric"
          className={inputClass()}
          value={values.number}
          onChange={(e) => set('number')(e.target.value)}
        />
      </Field>
      <Field label="Description (optional)" hint='e.g. "-370 level stoping"'>
        <input className={inputClass()} value={values.description} onChange={(e) => set('description')(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Rate per m³ (₹)" min="0" value={values.ratePerCubicMetre} onChange={set('ratePerCubicMetre')} />
        <NumberField label="Wage add-on (%)" min="0" value={values.wageMarkupPct} onChange={set('wageMarkupPct')} />
        <NumberField label="Driller wage (₹/day)" min="0" value={values.drillerWage} onChange={set('drillerWage')} />
        <NumberField label="Helper wage (₹/day)" min="0" value={values.helperWage} onChange={set('helperWage')} />
      </div>
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !values.number.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
