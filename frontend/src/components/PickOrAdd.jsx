import { useState } from 'react';
import Button from './Button';
import { inputClass } from './Field';

const ADD_NEW = '__add_new__';

// A <select> of existing records plus an inline "+ Add new" fallback. This
// is what lets a shift-card clerk add a driver/vehicle/loading point the
// first time they see it, without ever needing a pre-seeded master list —
// and because everyone picks from the same list afterwards, it doesn't
// reintroduce the old Excel's free-text typo problem.
export default function PickOrAdd({ label, options, value, onChange, onCreate, placeholder = 'Select…' }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
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
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const created = await onCreate(newName.trim());
      onChange(created._id);
      setAdding(false);
      setNewName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (adding) {
    return (
      <div>
        {/* A real <label> (not just styled text) so this is announced
            correctly by screen readers and findable by accessible name —
            same pattern as Field.jsx. */}
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label}
          <div className="mt-1 flex gap-2">
            <input
              autoFocus
              className={inputClass()}
              placeholder={`New ${label?.toLowerCase() || 'item'} name`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="button" onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? 'Adding…' : 'Add'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </label>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <select className={inputClass()} value={value || ''} onChange={handleSelect}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o._id} value={o._id}>
            {o.name}
          </option>
        ))}
        <option value={ADD_NEW}>+ Add new…</option>
      </select>
    </label>
  );
}
