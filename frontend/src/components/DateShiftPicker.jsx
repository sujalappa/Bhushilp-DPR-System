import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as shiftCardApi from '../api/shiftCard';
import Button from './Button';
import Field, { inputClass } from './Field';
import ErrorBanner from './ErrorBanner';
import Spinner from './Spinner';
import { todayIso } from '../utils/date';

const SHIFTS = ['I', 'II', 'III', 'General'];

// Shared "pick a date, pick a shift, confirm it's working" header — every
// shift-based form goes through the same shift-status concept (see the
// ShiftStatus model), so the Shift Card and Daily Production both use this
// instead of each reimplementing it. `children` is a render prop
// `(date, shift) => ReactNode`, rendered below the status card once the
// shift is working. Date and shift live in the URL (?date=&shift=) so a
// refresh, or coming back to the tab, keeps the clerk where they were.
export default function DateShiftPicker({ projectId, children }) {
  const [params, setParams] = useSearchParams();
  const today = todayIso();
  const rawDate = params.get('date') || '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate <= today ? rawDate : today;
  const shift = SHIFTS.includes(params.get('shift')) ? params.get('shift') : 'I';

  const setParam = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        return next;
      },
      { replace: true }
    );

  const [status, setStatus] = useState(null);
  const [remark, setRemark] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setEditingStatus(false);
    setError('');
    shiftCardApi
      .getShiftStatus(projectId, date, shift)
      .then((s) => {
        if (cancelled) return;
        setStatus(s.status);
        setRemark(s.remark || '');
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
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
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <Field label="Date">
          <input
            type="date"
            max={today}
            className={inputClass()}
            value={date}
            onChange={(e) => setParam('date', e.target.value)}
          />
        </Field>

        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Shift</span>
          <div className="grid grid-cols-4 gap-2">
            {SHIFTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setParam('shift', s)}
                className={`rounded-lg py-3 text-sm font-medium ${
                  shift === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {status !== null &&
          (editingStatus ? (
            <StatusEditor
              initialStatus={status}
              initialRemark={remark}
              saving={saving}
              onSave={saveStatus}
              onCancel={() => setEditingStatus(false)}
            />
          ) : (
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ${
                    status === 'working' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {status === 'working' ? 'Working shift' : 'Non-working shift'}
                </span>
                <button
                  type="button"
                  className="text-right text-sm text-brand-600 underline"
                  onClick={() => setEditingStatus(true)}
                >
                  {status === 'working' ? 'Change / add remark' : 'Change'}
                </button>
              </div>
              {remark && (
                <p className="mt-2 text-sm text-slate-600">
                  {status === 'non-working' ? 'Reason' : 'Remark'}: {remark}
                </p>
              )}
              {status === 'non-working' && (
                <p className="mt-2 text-sm text-slate-500">No entry needed for this shift.</p>
              )}
            </div>
          ))}
      </div>

      <ErrorBanner message={error} />

      {status === null && !error && <Spinner full />}
      {status === 'working' && children(date, shift)}
    </div>
  );
}

function StatusEditor({ initialStatus, initialRemark, saving, onSave, onCancel }) {
  const [localStatus, setLocalStatus] = useState(initialStatus);
  const [localRemark, setLocalRemark] = useState(initialRemark);

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
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
