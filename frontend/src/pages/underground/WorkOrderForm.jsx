import { useEffect, useState } from 'react';
import * as mastersApi from '../../api/masters';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import ErrorBanner from '../../components/ErrorBanner';
import { WORK_ORDER_FORMS } from '../../utils/workOrder';

const RATE_KEYS = ['ratePerCubicMetre', 'wageMarkupPct', 'drillerWage', 'helperWage'];

// Add or edit a work order: its number, which forms it has, the levels it
// covers, and the rates its labour and billing figures are worked out with. `initial` may
// have levelIds populated ({ _id, name }) or as plain ids.
export default function WorkOrderForm({ projectId, title, initial, onSubmit, onSaved, onCancel }) {
  const [values, setValues] = useState(() => ({
    number: initial.number || '',
    description: initial.description || '',
    ...Object.fromEntries(RATE_KEYS.map((k) => [k, initial[k] == null ? '' : String(initial[k])])),
  }));
  const [levelIds, setLevelIds] = useState(() => (initial.levelIds || []).map((l) => l._id || l));
  const [forms, setForms] = useState(() => initial.forms || WORK_ORDER_FORMS.map((f) => f.slug));
  const [levels, setLevels] = useState(null);
  const [newLevel, setNewLevel] = useState('');
  const [addingLevel, setAddingLevel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (value) => setValues((v) => ({ ...v, [key]: value }));

  useEffect(() => {
    let cancelled = false;
    mastersApi
      .listLevels(projectId, { active: true })
      .then((list) => !cancelled && setLevels(list))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const toggleForm = (slug) =>
    setForms((list) => (list.includes(slug) ? list.filter((x) => x !== slug) : [...list, slug]));
  const toggleLevel = (id) => setLevelIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  // A level typed here is created for the project and ticked for this work
  // order straight away.
  const handleAddLevel = async () => {
    setAddingLevel(true);
    setError('');
    try {
      const level = await mastersApi.createLevel(projectId, { name: newLevel.trim() });
      setLevels((list) => [...list, level]);
      setLevelIds((ids) => [...ids, level._id]);
      setNewLevel('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingLevel(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      onSaved(
        await onSubmit({ ...values, number: values.number.trim(), description: values.description.trim(), levelIds, forms })
      );
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
      <Field label="Description (optional)">
        <input className={inputClass()} value={values.description} onChange={(e) => set('description')(e.target.value)} />
      </Field>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Forms on this work order</span>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {WORK_ORDER_FORMS.map((f) => (
            <label key={f.slug} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-5 w-5" checked={forms.includes(f.slug)} onChange={() => toggleForm(f.slug)} />
              {f.label}
            </label>
          ))}
        </div>
        {forms.length === 0 && <p className="mt-1 text-sm text-amber-700">Tick at least one.</p>}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Levels on this work order</span>
        {levels === null ? (
          <p className="text-sm text-slate-400">Loading levels…</p>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {levels.map((l) => (
              <label key={l._id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={levelIds.includes(l._id)}
                  onChange={() => toggleLevel(l._id)}
                />
                {l.name}
              </label>
            ))}
            {levels.length === 0 && <span className="text-sm text-slate-500">No levels yet — add one below.</span>}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <input
            aria-label="New level name"
            placeholder="Add a level, e.g. -370'L"
            className={inputClass()}
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={handleAddLevel} disabled={addingLevel || !newLevel.trim()}>
            {addingLevel ? 'Adding…' : 'Add'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Rate per m³ (₹)" min="0" value={values.ratePerCubicMetre} onChange={set('ratePerCubicMetre')} />
        <NumberField label="Wage add-on (%)" min="0" value={values.wageMarkupPct} onChange={set('wageMarkupPct')} />
        <NumberField label="Driller wage (₹/day)" min="0" value={values.drillerWage} onChange={set('drillerWage')} />
        <NumberField label="Helper wage (₹/day)" min="0" value={values.helperWage} onChange={set('helperWage')} />
      </div>
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !values.number.trim() || forms.length === 0}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
