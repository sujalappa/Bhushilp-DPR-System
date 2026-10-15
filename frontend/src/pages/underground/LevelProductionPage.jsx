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
import PickOrAdd from '../../components/PickOrAdd';
import DateShiftPicker from '../../components/DateShiftPicker';
import ManpowerFields from './ManpowerFields';
import LevelFactors from './LevelFactors';
import { useAuth } from '../../context/AuthContext';
import { withReferenced } from '../../utils/options';
import { CREW_NAME_KEYS, crewNamesFromEntry, crewSummary, crewWorkers, emptyCrew } from '../../utils/crew';
import { shiftLabel, entryCount } from '../../utils/shift';
import useWorkOrder from '../../hooks/useWorkOrder';
import LabourAndBilling from './LabourAndBilling';

// Underground level production on one page, inside one work order: date +
// shift at the top, one entry form, then what's saved for that shift, the
// month's running totals per level, and the work order's labour and
// billing figures. An entry is one gang's shift on one level — keyed on
// (date, shift, work order, level, supervisor), so two gangs can work the
// same level in the same shift.
export default function LevelProductionPage() {
  const { projectId, workOrderId } = useParams();
  const { workOrder, error } = useWorkOrder(projectId, workOrderId);

  return (
    <AppShell title="Level Production" backTo={`/projects/${projectId}/wo/${workOrderId}`}>
      {workOrder && <p className="mb-4 text-sm font-medium text-slate-600">Work order {workOrder.number}</p>}
      <ErrorBanner message={error} />
      <DateShiftPicker projectId={projectId}>
        {(date, shift) => (
          <Entries key={`${date}|${shift}`} projectId={projectId} workOrderId={workOrderId} date={date} shift={shift} />
        )}
      </DateShiftPicker>
    </AppShell>
  );
}

const COUNT_KEYS = ['supervisors', 'drillers', 'helpers', 'muckers', 'blasters'];
const NUMERIC_KEYS = [...COUNT_KEYS, 'tubs'];
const emptyFields = { ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, ''])), ...emptyCrew(), remark: '' };
const emptySelection = { levelId: '', supervisorId: '' };

const fieldsFromEntry = (entry) => ({
  ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, entry[k] ?? ''])),
  ...crewNamesFromEntry(entry),
  remark: entry.remark || '',
});

const fmt = (n) => (n == null ? '' : String(Math.round(n * 1000) / 1000));
const describe = (entry) => `${entry.levelId?.name || 'Level'} · ${entry.supervisorId?.name || 'Supervisor'}`;

function Entries({ projectId, workOrderId, date, shift }) {
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [data, setData] = useState(null); // { entries, monthToDate, labour }
  const [loadError, setLoadError] = useState('');

  const [selection, setSelection] = useState(emptySelection);
  const [fields, setFields] = useState(emptyFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const formRef = useRef(null);

  const reload = useCallback(
    () => undergroundApi.listProduction(projectId, workOrderId, date, shift).then(setData),
    [projectId, workOrderId, date, shift]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      mastersApi.listLevels(projectId, { active: true }),
      mastersApi.listSupervisors(projectId, { active: true }),
      mastersApi.listWorkers(projectId, { active: true }),
      undergroundApi.listProduction(projectId, workOrderId, date, shift),
    ])
      .then(([levelList, supervisorList, workerList, production]) => {
        if (cancelled) return;
        setLevels(levelList);
        setSupervisors(supervisorList);
        setWorkers(workerList);
        setData(production);
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, workOrderId, date, shift]);

  if (loadError) return <ErrorBanner message={loadError} />;
  if (data === null) return <Spinner full />;

  const { entries, monthToDate, labour } = data;
  const levelOptions = withReferenced(levels, entries.map((e) => e.levelId));
  const supervisorOptions = withReferenced(supervisors, entries.map((e) => e.supervisorId));
  const workerOptions = withReferenced(workers, crewWorkers(entries));
  const pendingLevels = levels.filter((l) => !entries.some((e) => e.levelId?._id === l._id));

  const findEntry = (s) =>
    (s.levelId &&
      s.supervisorId &&
      entries.find((e) => e.levelId?._id === s.levelId && e.supervisorId?._id === s.supervisorId)) ||
    null;

  const editingEntry = findEntry(selection);
  const ready = Boolean(selection.levelId && selection.supervisorId);

  // Landing on a saved entry loads it; leaving one starts blank; moving
  // between two unsaved combinations keeps what's been typed.
  const select = (patch) => {
    const next = { ...selection, ...patch };
    const nextEntry = findEntry(next);
    if (nextEntry) setFields(fieldsFromEntry(nextEntry));
    else if (editingEntry) setFields(emptyFields);
    setSelection(next);
    setError('');
    setNotice('');
  };

  const resetForm = () => {
    setSelection(emptySelection);
    setFields(emptyFields);
    setError('');
  };

  const setField = (key) => (value) => {
    setFields((f) => ({ ...f, [key]: value }));
    setError('');
  };
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSave = async () => {
    if (fields.tubs === '') {
      setError('Tubs is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { date, shift, workOrderId, ...selection, remark: fields.remark.trim() };
      [...NUMERIC_KEYS, ...CREW_NAME_KEYS].forEach((key) => {
        payload[key] = fields[key];
      });
      const saved = await undergroundApi.upsertProduction(projectId, payload);
      // Refetched rather than patched locally, because a save also moves
      // the month-to-date and labour totals; the worker list too, since a
      // newly typed name was added to it.
      await Promise.all([reload(), mastersApi.listWorkers(projectId, { active: true }).then(setWorkers)]);
      setNotice(`${editingEntry ? 'Updated' : 'Saved'}: ${describe(saved)}`);
      resetForm();
      scrollToForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry) => {
    select({ levelId: entry.levelId._id, supervisorId: entry.supervisorId._id });
    scrollToForm();
  };

  const handleDelete = async (entry) => {
    if (!window.confirm(`Delete the entry for ${describe(entry)}? The level and supervisor themselves are kept.`)) return;
    setError('');
    setNotice('');
    try {
      await undergroundApi.deleteProduction(projectId, entry._id);
      if (editingEntry?._id === entry._id) resetForm();
      await reload();
    } catch (err) {
      setError(err.message);
      scrollToForm();
    }
  };

  // Same arithmetic the server applies on save, shown while typing. The
  // conversion factors belong to the level that's picked.
  const level = levelOptions.find((l) => l._id === selection.levelId);
  const tubs = Number(fields.tubs) || 0;
  const tons = tubs * (level?.tonsPerTub ?? 1.5);
  const cubicMetres = tons / (level?.tonsPerCubicMetre ?? 3.5);
  const omsCrew = (Number(fields.supervisors) || 0) + (Number(fields.muckers) || 0) + (Number(fields.blasters) || 0);
  const shiftTubs = entries.reduce((sum, e) => sum + (e.tubs || 0), 0);
  const shiftTons = entries.reduce((sum, e) => sum + (e.tons || 0), 0);

  return (
    <div className="space-y-6">
      <section ref={formRef} className="scroll-mt-28 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">{editingEntry ? 'Edit saved entry' : 'New entry'}</h2>
          {(selection.levelId || selection.supervisorId) && (
            <button type="button" className="text-sm text-slate-500 underline" onClick={resetForm}>
              Clear
            </button>
          )}
        </div>

        {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">✓ {notice}</p>}

        <PickOrAdd
          label="Level"
          options={levelOptions}
          value={selection.levelId}
          onChange={(levelId) => select({ levelId })}
          onCreate={async (name) => {
            const level = await mastersApi.createLevel(projectId, { name });
            setLevels((l) => [...l, level]);
            return level;
          }}
        />

        {level && (
          <LevelFactors
            // Keyed so picking another level closes an open editor.
            key={level._id}
            projectId={projectId}
            level={level}
            canEdit={user.isSuperAdmin}
            onSaved={async (updated) => {
              setLevels((list) => list.map((l) => (l._id === updated._id ? updated : l)));
              // Saved entries and month-to-date totals for this level are
              // recalculated by the server.
              await reload();
            }}
          />
        )}

        <PickOrAdd
          label="Supervisor name"
          options={supervisorOptions}
          value={selection.supervisorId}
          onChange={(supervisorId) => select({ supervisorId })}
          onCreate={async (name) => {
            const supervisor = await mastersApi.createSupervisor(projectId, { name });
            setSupervisors((s) => [...s, supervisor]);
            return supervisor;
          }}
        />

        {!ready && <p className="text-sm text-slate-500">Pick a level and the gang&apos;s supervisor to fill in the entry.</p>}

        {ready && (
          <>
            <ManpowerFields
              order={COUNT_KEYS}
              fields={fields}
              setField={setField}
              workers={workerOptions}
            />

            <NumberField
              label="Tubs"
              hint="Required."
              inputMode="numeric"
              min="0"
              value={fields.tubs}
              onChange={setField('tubs')}
            />

            {fields.tubs !== '' && (
              <p className="text-sm text-slate-500">
                {fmt(tons)} t · {fmt(cubicMetres)} m³{tons > 0 && ` · OMS ${fmt(omsCrew / tons)}`}
              </p>
            )}

            <Field label="Remark (optional)">
              <input className={inputClass()} value={fields.remark} onChange={(e) => setField('remark')(e.target.value)} />
            </Field>
          </>
        )}

        <ErrorBanner message={error} />

        {ready && (
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editingEntry ? 'Update entry' : 'Save entry'}
          </Button>
        )}
      </section>

      {pendingLevels.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-600">Levels not entered yet ({pendingLevels.length})</h2>
          <div className="flex flex-wrap gap-2">
            {pendingLevels.map((l) => (
              <button
                key={l._id}
                type="button"
                onClick={() => {
                  select({ levelId: l._id });
                  scrollToForm();
                }}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-brand-300"
              >
                {l.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-600">
          Saved for {shiftLabel(shift)} · {entryCount(entries.length)}
          {entries.length > 0 && ` · ${shiftTubs} tubs · ${fmt(shiftTons)} t`}
        </h2>

        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Nothing saved for this shift yet.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry._id}
                className={`flex items-start justify-between gap-3 rounded-lg border bg-white p-4 shadow-sm ${
                  editingEntry?._id === entry._id ? 'border-brand-500' : 'border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{describe(entry)}</div>
                  <div className="text-sm text-slate-500">
                    {[
                      `${entry.tubs} tubs`,
                      `${fmt(entry.tons)} t`,
                      `${fmt(entry.cubicMetres)} m³`,
                      entry.totalManpower > 0 && `${entry.totalManpower} manpower`,
                      entry.totalManpower > 0 && entry.oms != null && `OMS ${fmt(entry.oms)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {crewSummary(entry) && <div className="mt-1 text-sm text-slate-500">{crewSummary(entry)}</div>}
                  {entry.remark && <div className="mt-1 text-sm text-slate-500">“{entry.remark}”</div>}
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm font-medium">
                  <button type="button" className="text-brand-600" onClick={() => handleEdit(entry)}>
                    Edit
                  </button>
                  <button type="button" className="text-red-600" onClick={() => handleDelete(entry)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {monthToDate.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-600">Month to date, up to {date}</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                  <th className="px-3 py-2 font-medium">Level</th>
                  <th className="px-3 py-2 text-right font-medium">Tubs</th>
                  <th className="px-3 py-2 text-right font-medium">Tons</th>
                  <th className="px-3 py-2 text-right font-medium">m³</th>
                </tr>
              </thead>
              <tbody>
                {monthToDate.map((m) => (
                  <tr key={m.levelId} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-900">{m.levelName}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{m.tubs}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmt(m.tons)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmt(m.cubicMetres)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <LabourAndBilling date={date} labour={labour} />
    </div>
  );
}
