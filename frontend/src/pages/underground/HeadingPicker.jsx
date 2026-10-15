import { useState } from 'react';
import * as mastersApi from '../../api/masters';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import PickOrAdd from '../../components/PickOrAdd';

const ADD_NEW = '__add_new__';

// The type of work names the heading ("-370 · Cross Cut"), as in the
// workbook; only "Other" needs a name typed.
const KINDS = [
  { value: 'ore-drive', label: 'Ore Drive' },
  { value: 'cross-cut', label: 'Cross Cut' },
  { value: 'bottom-jigger', label: 'Bottom Jigger' },
  { value: 'other', label: 'Other' },
];

// Dropdown of headings with an inline "add new" form: the level and the
// type of work, plus (only if it's partly driven already) the metres done
// before entries began here. `levels` are the work order's levels; new
// levels are added on the work order itself, not here.
export default function HeadingPicker({ projectId, headings, levels, value, onChange, onHeadingCreated, labelOf }) {
  const [adding, setAdding] = useState(false);
  const [levelId, setLevelId] = useState('');
  const [kind, setKind] = useState('ore-drive');
  const [otherName, setOtherName] = useState('');
  const [showOpening, setShowOpening] = useState(false);
  const [openingProgress, setOpeningProgress] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const isOther = kind === 'other';
  const name = isOther ? otherName.trim() : KINDS.find((k) => k.value === kind).label;

  const handleSelect = (e) => {
    if (e.target.value === ADD_NEW) {
      setAdding(true);
      setError('');
    } else {
      onChange(e.target.value);
    }
  };

  const close = () => {
    setAdding(false);
    setOtherName('');
    setShowOpening(false);
    setOpeningProgress('');
    setError('');
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const heading = await mastersApi.createHeading(projectId, { levelId, name, kind, openingProgress });
      onHeadingCreated(heading);
      onChange(heading._id);
      close();
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

      <PickOrAdd label="Level" options={levels} value={levelId} onChange={setLevelId} allowAdd={false} />

      <Field label="Type of work">
        <select className={inputClass()} value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>

      {isOther && (
        <Field label="Name of the work" hint='e.g. "Raise", "Winze"'>
          <input className={inputClass()} value={otherName} onChange={(e) => setOtherName(e.target.value)} />
        </Field>
      )}

      {showOpening ? (
        <NumberField
          label="Metres already driven"
          hint="Progress made before entries start here, so the running total carries on."
          min="0"
          value={openingProgress}
          onChange={setOpeningProgress}
        />
      ) : (
        <button type="button" className="text-sm text-brand-600 underline" onClick={() => setShowOpening(true)}>
          Already partly driven? Add the metres done before
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" onClick={handleCreate} disabled={creating || !levelId || !name}>
          {creating ? 'Adding…' : 'Add heading'}
        </Button>
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
