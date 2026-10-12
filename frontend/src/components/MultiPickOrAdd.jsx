import { useState } from 'react';
import Button from './Button';
import { inputClass } from './Field';

const ADD_NEW = '__add_new__';

// Pick several records from a master list, with an inline "add new" for a
// name that isn't there yet — the multi-select sibling of PickOrAdd. The
// chosen ones show as chips that can be removed; `value` is a list of ids.
export default function MultiPickOrAdd({ label, options, value, onChange, onCreate, placeholder = 'Add a name…' }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const chosen = value.map((id) => options.find((o) => o._id === id)).filter(Boolean);
  const available = options.filter((o) => !value.includes(o._id));

  const handleSelect = (e) => {
    if (e.target.value === ADD_NEW) {
      setAdding(true);
      setError('');
    } else if (e.target.value) {
      onChange([...value, e.target.value]);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const created = await onCreate(newName.trim());
      onChange([...value, created._id]);
      setAdding(false);
      setNewName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      {adding ? (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
          {/* Wraps: this often sits in a narrow column beside a count. */}
          <div className="flex flex-wrap gap-2">
            <input
              autoFocus
              className={inputClass('min-w-[8rem] flex-1')}
              placeholder="New name"
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
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
          {/* Always shows the placeholder: picking a name adds a chip below. */}
          <select className={inputClass()} value="" onChange={handleSelect}>
            <option value="" disabled>
              {placeholder}
            </option>
            {available.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
            <option value={ADD_NEW}>+ Add new…</option>
          </select>
        </label>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {chosen.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chosen.map((o) => (
            <span key={o._id} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700">
              {o.name}
              <button
                type="button"
                aria-label={`Remove ${o.name}`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200"
                onClick={() => onChange(value.filter((id) => id !== o._id))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
