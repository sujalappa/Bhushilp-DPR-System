import { useState } from 'react';
import * as mastersApi from '../../api/masters';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import PickOrAdd from '../../components/PickOrAdd';

const ADD_NEW = '__add_new__';

const KINDS = [
  { value: 'ore-drive', label: 'Ore drive' },
  { value: 'cross-cut', label: 'Cross cut' },
  { value: 'other', label: 'Other' },
];

// Dropdown of headings with an inline "add new" form. Like PickOrAdd, but a
// heading needs more than a name: which level it's on, what kind of work it
// is, and how many metres were already driven before entries began here.
// `levels` are the work order's levels; new levels are added on the work
// order itself, not here.
export default function HeadingPicker({ projectId, headings, levels, value, onChange, onHeadingCreated, labelOf }) {
  const [adding, setAdding] = useState(false);
  const [levelId, setLevelId] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('ore-drive');
  const [openingProgress, setOpeningProgress] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSelect = (e) => {
    if (e.target.value === ADD_NEW) {
      setAdding(true);
      setError('');
    } else {
      onChange(e.target.value);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const heading = await mastersApi.createHeading(projectId, { levelId, name: name.trim(), kind, openingProgress });
      onHeadingCreated(heading);
      onChange(heading._id);
      setAdding(false);
      setName('');
      setOpeningProgress('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (!adding) {
    return (
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Heading</span>
        <select className={inputClass()} value={value || ''} onChange={handleSelect}>
          <option value="" disabled>
            Select…
          </option>
          {headings.map((h) => (
            <option key={h._id} value={h._id}>
              {labelOf(h)}
            </option>
          ))}
          <option value={ADD_NEW}>+ Add new heading…</option>
        </select>
      </label>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <h3 className="text-sm font-semibold text-slate-900">New heading</h3>

      <PickOrAdd
        label="Level"
        options={levels}
        value={levelId}
        onChange={setLevelId}
        allowAdd={false}
      />

      <Field label="Heading name" hint='e.g. "Ore Drive", "Cross Cut", "Bottom Jigger"'>
        <input className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label="Kind of work">
        <select className={inputClass()} value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>

      <NumberField
        label="Metres already driven (optional)"
        hint="Progress made before entries start here, so the running total carries on."
        min="0"
        value={openingProgress}
        onChange={setOpeningProgress}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" onClick={handleCreate} disabled={creating || !levelId || !name.trim()}>
          {creating ? 'Adding…' : 'Add heading'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
