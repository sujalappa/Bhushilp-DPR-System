import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as mastersApi from '../../api/masters';
import * as undergroundApi from '../../api/underground';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import NumberField from '../../components/NumberField';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import DateShiftPicker from '../../components/DateShiftPicker';
import ManpowerFields from './ManpowerFields';
import HeadingPicker from './HeadingPicker';
import { withReferenced } from '../../utils/options';
import { CREW_KEYS, crewIdsFromEntry, crewSummary, crewWorkers, emptyCrew } from '../../utils/crew';
import { shiftLabel, entryCount } from '../../utils/shift';

// Underground development on one page: date + shift at the top, one entry
// form, then what's saved for that shift and the metres driven to date on
// each heading. An entry is one shift's work on one heading.
export default function DevelopmentPage() {
  const { projectId } = useParams();

  return (
    <AppShell title="Development" backTo={`/projects/${projectId}`}>
      <DateShiftPicker projectId={projectId}>
        {(date, shift) => <Entries key={`${date}|${shift}`} projectId={projectId} date={date} shift={shift} />}
      </DateShiftPicker>
    </AppShell>
  );
}

const COUNT_KEYS = ['supervisors', 'drillers', 'helpers', 'blasters', 'muckers'];
const NUMERIC_KEYS = [...COUNT_KEYS, 'tons', 'filling', 'progress'];
const emptyFields = { ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, ''])), ...emptyCrew(), remark: '' };

const fieldsFromEntry = (entry) => ({
  ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, entry[k] ?? ''])),
  ...crewIdsFromEntry(entry),
  remark: entry.remark || '',
});

const fmt = (n) => (n == null ? '' : String(Math.round(n * 1000) / 1000));
const headingLabel = (h) => `${h?.levelId?.name || 'Level'} · ${h?.name || 'Heading'}`;

function Entries({ projectId, date, shift }) {
  const [levels, setLevels] = useState([]);
  const [headings, setHeadings] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [data, setData] = useState(null); // { entries, progressToDate }
  const [loadError, setLoadError] = useState('');

  const [headingId, setHeadingId] = useState('');
  const [fields, setFields] = useState(emptyFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef(null);

  const reload = useCallback(
    () => undergroundApi.listDevelopment(projectId, date, shift).then(setData),
    [projectId, date, shift]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      mastersApi.listLevels(projectId, { active: true }),
      mastersApi.listHeadings(projectId, { active: true }),
      mastersApi.listWorkers(projectId, { active: true }),
      undergroundApi.listDevelopment(projectId, date, shift),
    ])
      .then(([levelList, headingList, workerList, development]) => {
        if (cancelled) return;
        setLevels(levelList);
        setHeadings(headingList);
        setWorkers(workerList);
        setData(development);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, date, shift]);

  if (loadError) return <ErrorBanner message={loadError} />;
  if (data === null) return <Spinner full />;

  const { entries, progressToDate } = data;
  const headingOptions = withReferenced(headings, entries.map((e) => e.headingId));
  const workerOptions = withReferenced(workers, crewWorkers(entries));
  const pendingHeadings = headings.filter((h) => !entries.some((e) => e.headingId?._id === h._id));
  const metresById = new Map(progressToDate.map((p) => [p.headingId, p.metres]));

  const findEntry = (id) => (id && entries.find((e) => e.headingId?._id === id)) || null;
  const editingEntry = findEntry(headingId);
  const heading = headingOptions.find((h) => h._id === headingId) || null;
  const isOreDrive = heading?.kind === 'ore-drive';

  // Landing on a saved entry loads it; leaving one starts blank; moving
  // between two unsaved headings keeps what's been typed.
  const selectHeading = (id) => {
    const nextEntry = findEntry(id);
    if (nextEntry) setFields(fieldsFromEntry(nextEntry));
    else if (editingEntry) setFields(emptyFields);
    setHeadingId(id);
    setError('');
    setNotice('');
  };

  const resetForm = () => {
    setHeadingId('');
    setFields(emptyFields);
    setError('');
  };

  const setField = (key) => (value) => {
    setFields((f) => ({ ...f, [key]: value }));
    setError('');
  };
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSave = async () => {
    if (NUMERIC_KEYS.every((k) => fields[k] === '')) {
      setError('Enter at least one figure.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { date, shift, headingId, remark: fields.remark.trim() };
      NUMERIC_KEYS.forEach((key) => {
        // An ore drive has no filling; don't keep a value typed before the
        // heading was switched to one.
        payload[key] = key === 'filling' && isOreDrive ? '' : fields[key];
      });
      CREW_KEYS.forEach((key) => {
        payload[key] = fields[key];
      });
      const saved = await undergroundApi.upsertDevelopment(projectId, payload);
      // Refetched rather than patched locally, because a save also moves
      // the heading's progress to date.
      await reload();
      setNotice(`${editingEntry ? 'Updated' : 'Saved'}: ${headingLabel(saved.headingId)}`);
      resetForm();
      scrollToForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete the entry for ${headingLabel(entry.headingId)}? The heading itself is kept.`)) return;
    setError('');
    setNotice('');
    try {
      await undergroundApi.deleteDevelopment(projectId, entry._id);
      if (editingEntry?._id === entry._id) resetForm();
      await reload();
    } catch (err) {
      setError(err.message);
      scrollToForm();
    }
  };

  return (
    <div className="space-y-6">
      <section ref={formRef} className="scroll-mt-28 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{editingEntry ? 'Edit saved entry' : 'New entry'}</h2>
          {headingId && (
            <button type="button" className="text-sm text-slate-500 underline" onClick={resetForm}>
              Clear
            </button>
          )}
        </div>

        {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">✓ {notice}</p>}

        <HeadingPicker
          projectId={projectId}
          headings={headingOptions}
          levels={levels}
          value={headingId}
          onChange={selectHeading}
          onHeadingCreated={(h) => setHeadings((list) => [...list, h])}
          onLevelCreated={(l) => setLevels((list) => [...list, l])}
          labelOf={headingLabel}
        />

        {!headingId && <p className="text-sm text-slate-500">Pick a heading to fill in the entry.</p>}

        {headingId && (
          <>
            <ManpowerFields
              order={COUNT_KEYS}
              fields={fields}
              setField={setField}
              workers={workerOptions}
              onCreateWorker={async (name) => {
                const worker = await mastersApi.createWorker(projectId, { name });
                setWorkers((w) => [...w, worker]);
                return worker;
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label={isOreDrive ? 'Ore (tons)' : 'Rock (tons)'}
                min="0"
                value={fields.tons}
                onChange={setField('tons')}
              />
              {!isOreDrive && <NumberField label="Filling" min="0" value={fields.filling} onChange={setField('filling')} />}
              <NumberField label="Progress (metres)" min="0" value={fields.progress} onChange={setField('progress')} />
            </div>

            <Field label="Remark (optional)">
              <input className={inputClass()} value={fields.remark} onChange={(e) => setField('remark')(e.target.value)} />
            </Field>
          </>
        )}

        <ErrorBanner message={error} />

        {headingId && (
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editingEntry ? 'Update entry' : 'Save entry'}
          </Button>
        )}
      </section>

      {pendingHeadings.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-600">Headings not entered yet ({pendingHeadings.length})</h2>
          <div className="flex flex-wrap gap-2">
            {pendingHeadings.map((h) => (
              <button
                key={h._id}
                type="button"
                onClick={() => {
                  selectHeading(h._id);
                  scrollToForm();
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-brand-300"
              >
                {headingLabel(h)}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-600">
          Saved for {shiftLabel(shift)} · {entryCount(entries.length)}
        </h2>

        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Nothing saved for this shift yet.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => {
              const manpower = COUNT_KEYS.reduce((sum, k) => sum + (entry[k] || 0), 0);
              return (
                <div
                  key={entry._id}
                  className={`flex items-start justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm ${
                    editingEntry?._id === entry._id ? 'border-brand-500' : 'border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{headingLabel(entry.headingId)}</div>
                    <div className="text-sm text-slate-500">
                      {[
                        entry.tons != null && `${fmt(entry.tons)} t`,
                        entry.filling != null && `${fmt(entry.filling)} filling`,
                        entry.progress != null && `${fmt(entry.progress)} m`,
                        manpower > 0 && `${manpower} manpower`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {crewSummary(entry) && <div className="mt-1 text-sm text-slate-500">{crewSummary(entry)}</div>}
                    {entry.remark && <div className="mt-1 text-sm text-slate-500">“{entry.remark}”</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-sm font-medium">
                    <button
                      type="button"
                      className="text-brand-600"
                      onClick={() => {
                        selectHeading(entry.headingId._id);
                        scrollToForm();
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="text-red-600" onClick={() => handleDelete(entry)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {headings.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-600">Progress to date, up to {date}</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                {headings.map((h) => (
                  <tr key={h._id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-900">{headingLabel(h)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmt(metresById.get(h._id) ?? h.openingProgress)} m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
