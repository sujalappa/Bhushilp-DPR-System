import { useEffect, useState } from 'react';
import * as shiftCardApi from '../api/shiftCard';
import Button from './Button';
import Field, { inputClass } from './Field';
import ErrorBanner from './ErrorBanner';
import Spinner from './Spinner';
import { todayIso } from '../utils/date';

const SHIFTS = ['I', 'II', 'III', 'General'];

// Shared "pick a date, pick a shift, confirm it's working" step — every
// form drills down through the same shift-status concept (see ShiftStatus
// model), so this is used by both the Shift Card and Daily Production
// entry points instead of each reimplementing it. `children` is a render
// prop `(date, shift) => ReactNode`, shown only once the shift is confirmed
// working; a non-working shift shows a generic message instead.
export default function DateShiftPicker({ projectId, children }) {
  const [date, setDate] = useState(todayIso());
  const [shift, setShift] = useState('I');
  const [status, setStatus] = useState(null);
  const [remark, setRemark] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(null);
    setEditingStatus(false);
    shiftCardApi
      .getShiftStatus(projectId, date, shift)
      .then((s) => {
        setStatus(s.status);
        setRemark(s.remark || '');
      })
      .catch((err) => setError(err.message));
  }, [projectId, date, shift]);

  const saveStatus = async (nextStatus, nextRemark) => {
    setSaving(true);
    setError('');
    try {
      const s = await shiftCardApi.setShiftStatus(projectId, {
        date,
        shift,
        status: nextStatus,
        remark: nextRemark,
      });
      setStatus(s.status);
      setRemark(s.remark || '');
      setEditingStatus(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Field label="Date">
        <input
          type="date"
          max={todayIso()}
          className={inputClass()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Shift</span>
        <div className="grid grid-cols-4 gap-2">
          {SHIFTS.map((s) => (
            <button
              key={s}
              onClick={() => setShift(s)}
              className={`rounded-lg py-3 text-sm font-medium ${
                shift === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} />

      {status === null ? (
        <Spinner full />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {!editingStatus ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    status === 'working' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {status === 'working' ? 'Working' : 'Non-working'}
                </span>
                <button className="text-sm text-brand-600 underline" onClick={() => setEditingStatus(true)}>
                  Change
                </button>
              </div>
              {remark && (
                <p className="mb-3 text-sm text-slate-600">
                  {status === 'non-working' ? 'Reason' : 'Remark'}: {remark}
                </p>
              )}
              {status === 'working' ? (
                children(date, shift)
              ) : (
                <p className="text-sm text-slate-500">No entry needed for this shift.</p>
              )}
            </>
          ) : (
            <StatusEditor
              initialStatus={status}
              initialRemark={remark}
              saving={saving}
              onSave={saveStatus}
              onCancel={() => setEditingStatus(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatusEditor({ initialStatus, initialRemark, saving, onSave, onCancel }) {
  const [localStatus, setLocalStatus] = useState(initialStatus);
  const [localRemark, setLocalRemark] = useState(initialRemark);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={localStatus === 'working' ? 'primary' : 'secondary'}
          className="flex-1"
          onClick={() => setLocalStatus('working')}
        >
          Working
        </Button>
        <Button
          type="button"
          variant={localStatus === 'non-working' ? 'primary' : 'secondary'}
          className="flex-1"
          onClick={() => setLocalStatus('non-working')}
        >
          Non-working
        </Button>
      </div>

      <Field
        label={localStatus === 'non-working' ? 'Reason' : 'Remark (optional)'}
        hint={localStatus === 'non-working' ? 'e.g. "Idle due to Rain"' : 'e.g. "Rain mid-shift reduced trip count"'}
      >
        <input
          className={inputClass()}
          value={localRemark}
          onChange={(e) => setLocalRemark(e.target.value)}
          autoFocus
        />
      </Field>

      <div className="flex gap-2">
        <Button
          disabled={saving || (localStatus === 'non-working' && !localRemark.trim())}
          onClick={() => onSave(localStatus, localRemark.trim())}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
