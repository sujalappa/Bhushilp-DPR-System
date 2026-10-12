import { useState } from 'react';
import * as mastersApi from '../../api/masters';
import Button from '../../components/Button';
import NumberField from '../../components/NumberField';
import ErrorBanner from '../../components/ErrorBanner';

// Shows how the picked level converts tubs to tons and tons to m3, right
// under the level dropdown, with an inline editor. Editing is limited to
// the superadmin (`canEdit`) because a change recalculates every entry
// already saved for that level.
export default function LevelFactors({ projectId, level, canEdit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [tonsPerTub, setTonsPerTub] = useState('');
  const [tonsPerCubicMetre, setTonsPerCubicMetre] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startEditing = () => {
    setTonsPerTub(String(level.tonsPerTub));
    setTonsPerCubicMetre(String(level.tonsPerCubicMetre));
    setError('');
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await mastersApi.updateLevel(projectId, level._id, { tonsPerTub, tonsPerCubicMetre });
      await onSaved(updated);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <span>
          1 tub = {level.tonsPerTub} t · {level.tonsPerCubicMetre} t = 1 m³
        </span>
        {canEdit && (
          <button type="button" className="shrink-0 font-medium text-brand-600" onClick={startEditing}>
            Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Tons per tub" min="0" value={tonsPerTub} onChange={setTonsPerTub} />
        <NumberField label="Tons per m³" min="0" value={tonsPerCubicMetre} onChange={setTonsPerCubicMetre} />
      </div>
      <p className="text-xs text-slate-500">
        Applies to level {level.name} only, and recalculates every entry already saved for it.
      </p>
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
