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
import { CREW, CREW_NAME_KEYS, crewNamesFromEntry, crewSummary, crewWorkers, emptyCrew } from '../../utils/crew';
import { shiftLabel, entryCount } from '../../utils/shift';
import useWorkOrder from '../../hooks/useWorkOrder';
import { workOrderForms } from '../../utils/workOrder';
import LabourAndBilling from './LabourAndBilling';
import WaitingBadge from './WaitingBadge';
import { enqueue, itemsFor, removeItem, useOutbox } from '../../offline/outbox';
import { onSynced } from '../../offline/sync';
import { managesProject, roleOf } from '../../utils/roles';

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
      <ErrorBanner message={error} />
      {!workOrder && !error && <Spinner full />}
      {workOrder && !workOrderForms(workOrder).includes('ug-production') && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Work order {workOrder.number} doesn&apos;t have Level Production.
        </p>
      )}
      {workOrder && workOrderForms(workOrder).includes('ug-production') && (
        <>
          <p className="mb-4 text-sm font-medium text-slate-600">Work order {workOrder.number}</p>
          <DateShiftPicker projectId={projectId}>
            {(date, shift) => (
              <Entries key={`${date}|${shift}`} projectId={projectId} workOrder={workOrder} date={date} shift={shift} />
            )}
          </DateShiftPicker>
        </>
      )}
    </AppShell>
  );
}

const COUNT_KEYS = ['supervisors', 'drillers', 'helpers', 'muckers', 'blasters'];
const NUMERIC_KEYS = [...COUNT_KEYS, 'tubs'];
const emptyFields = { ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, ''])), ...emptyCrew(), remark: '' };
const emptySelection = { levelId: '', supervisorId: '' };

// A supervisor filling in the form is that gang's supervisor, so their own
// name is picked for them (they can still pick someone else). Matched to
// the supervisor list ignoring case; if they aren't on it yet, they're
// added by name when the entry is saved.
const ownSupervisorId = (supervisors, name) =>
  supervisors.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())?._id ||
  `new:${name.trim()}`;

const fieldsFromEntry = (entry) => ({
  ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, entry[k] ?? ''])),
  ...crewNamesFromEntry(entry),
  remark: entry.remark || '',
});

const fmt = (n) => (n == null ? '' : String(Math.round(n * 1000) / 1000));
const describe = (entry) => `${entry.levelId?.name || 'Level'} · ${entry.supervisorId?.name || 'Supervisor'}`;
const numberOrNull = (v) => (v === '' || v == null ? null : Number(v));

// A supervisor typed in while offline has no id yet: it's held as
// "new:<name>" and sent by name, for the server to match or add.
const NEW_SUPERVISOR = 'new:';
const sendable = (payload) => {
  if (!payload.supervisorId.startsWith(NEW_SUPERVISOR)) return payload;
  const { supervisorId, ...rest } = payload;
  return { ...rest, supervisorName: supervisorId.slice(NEW_SUPERVISOR.length) };
};

// One gang's entry, as the server keys it, for matching a waiting copy on
// the phone to the saved one it replaces.
const gangKey = (levelId, supervisorId) => `${levelId}|${String(supervisorId).toLowerCase()}`;
const entryKey = (e) => gangKey(e.levelId?._id, e.supervisorId?._id);
// An outbox item shown like a saved entry, carrying the item itself.
const waitingEntry = (item) => ({ ...item.display.entry, _id: `outbox:${item.id}`, outbox: item });

function Entries({ projectId, workOrder, date, shift }) {
  const workOrderId = workOrder._id;
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [data, setData] = useState(null); // { entries, monthToDate, labour }
  const [loadError, setLoadError] = useState('');

  const [picked, setPicked] = useState(emptySelection);
  const canManage = managesProject(user, projectId);
  const isSupervisor = roleOf(user) === 'supervisor';
  const [fields, setFields] = useState(emptyFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { text, onPhone }
  const formRef = useRef(null);
  const outbox = useOutbox();

  const reload = useCallback(
    () => undergroundApi.listProduction(projectId, workOrderId, date, shift).then(setData),
    [projectId, workOrderId, date, shift]
  );

  // When a waiting entry of this shift reaches the server, show the
  // server's copy (and any supervisor or worker it added) instead.
  useEffect(
    () =>
      onSynced((item) => {
        const p = item.payload;
        if (item.kind !== 'ug-production' || item.projectId !== projectId) return;
        if (p.workOrderId !== workOrderId || p.date !== date || p.shift !== shift) return;
        reload().catch(() => {});
        mastersApi.listSupervisors(projectId, { active: true }).then(setSupervisors).catch(() => {});
        mastersApi.listWorkers(projectId, { active: true }).then(setWorkers).catch(() => {});
      }),
    [reload, projectId, workOrderId, date, shift]
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

  const { monthToDate, labour, offline } = data;
  // Entries waiting on the phone stand in for the saved ones they'll replace.
  const waiting = itemsFor(outbox, 'ug-production', projectId, workOrderId, date, shift).map(waitingEntry);
  const waitingKeys = new Set(waiting.map(entryKey));
  const entries = [...data.entries.filter((e) => !waitingKeys.has(entryKey(e))), ...waiting];
  // Only the levels this work order covers (the master list carries the
  // current conversion factors, so it's filtered rather than replaced).
  const workOrderLevelIds = new Set(workOrder.levelIds.map((l) => l._id));
  const levelOptions = withReferenced(
    levels.filter((l) => workOrderLevelIds.has(l._id)),
    entries.map((e) => e.levelId)
  );
  const ownId = isSupervisor ? ownSupervisorId(supervisors, user.name) : '';
  // What's picked, with the supervisor's own name standing in until they
  // choose otherwise.
  const selection = { ...picked, supervisorId: picked.supervisorId || ownId };
  const supervisorOptions = withReferenced(supervisors, [
    ...entries.map((e) => e.supervisorId),
    ...(ownId.startsWith('new:') ? [{ _id: ownId, name: user.name.trim() }] : []),
  ]);
  const workerOptions = withReferenced(workers, crewWorkers(entries));
  const pendingLevels = levelOptions.filter((l) => !entries.some((e) => e.levelId?._id === l._id));

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
    setPicked(next);
    setError('');
    setNotice(null);
  };

  const resetForm = () => {
    setPicked(emptySelection);
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
    const payload = { date, shift, workOrderId, ...selection, remark: fields.remark.trim() };
    [...NUMERIC_KEYS, ...CREW_NAME_KEYS].forEach((key) => {
      payload[key] = fields[key];
    });
    const key = [workOrderId, date, shift, gangKey(selection.levelId, selection.supervisorId)].join('|');
    const waitingCopy = outbox.find((i) => i.kind === 'ug-production' && i.projectId === projectId && i.key === key);
    try {
      if (!navigator.onLine) {
        keepOnPhone(key, payload);
        return;
      }
      const saved = await undergroundApi.upsertProduction(projectId, sendable(payload));
      // The server now has the latest; an older copy waiting on the phone
      // mustn't be sent over it later.
      if (waitingCopy) removeItem(waitingCopy.id);
      // Refetched rather than patched locally, because a save also moves
      // the month-to-date and labour totals; the supervisor and worker
      // lists too, since a newly typed name was added to them.
      await Promise.all([
        reload(),
        mastersApi.listSupervisors(projectId, { active: true }).then(setSupervisors),
        mastersApi.listWorkers(projectId, { active: true }).then(setWorkers),
      ]);
      setNotice({ text: `${editingEntry ? 'Updated' : 'Saved'}: ${describe(saved)}` });
      resetForm();
      scrollToForm();
    } catch (err) {
      if (err.offline) keepOnPhone(key, payload);
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // No signal: keep the entry on the phone, shown in the list as waiting,
  // with the same figures the server would work out.
  const keepOnPhone = (key, payload) => {
    const entry = {
      levelId: levelOptions.find((l) => l._id === selection.levelId),
      supervisorId: supervisorOptions.find((x) => x._id === selection.supervisorId),
      ...Object.fromEntries(NUMERIC_KEYS.map((k) => [k, numberOrNull(fields[k])])),
      remark: payload.remark,
      tons,
      cubicMetres,
      totalManpower: COUNT_KEYS.reduce((sum, k) => sum + (Number(fields[k]) || 0), 0),
      drillerHelper: (Number(fields.drillers) || 0) + (Number(fields.helpers) || 0),
      oms: tons > 0 ? omsCrew / tons : null,
    };
    CREW.forEach((c) => {
      const names = fields[c.namesKey].map((n) => n.trim()).filter(Boolean);
      entry[c.idsKey] = names.map((name) => ({ _id: `name:${name.toLowerCase()}`, name }));
    });
    enqueue({
      kind: 'ug-production',
      projectId,
      key,
      payload: sendable(payload),
      display: { title: describe(entry), entry },
    });
    setNotice({ text: `Saved on this phone: ${describe(entry)}. It will be sent when there's signal.`, onPhone: true });
    resetForm();
    scrollToForm();
  };

  const handleEdit = (entry) => {
    select({ levelId: entry.levelId._id, supervisorId: entry.supervisorId._id });
    scrollToForm();
  };

  const handleDelete = async (entry) => {
    if (entry.outbox) {
      if (!window.confirm(`Discard the unsent entry for ${describe(entry)}?`)) return;
      removeItem(entry.outbox.id);
      if (editingEntry?._id === entry._id) resetForm();
      return;
    }
    if (!window.confirm(`Delete the entry for ${describe(entry)}? The level and supervisor themselves are kept.`)) return;
    setError('');
    setNotice(null);
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
          {(picked.levelId || picked.supervisorId) && (
            <button type="button" className="text-sm text-slate-500 underline" onClick={resetForm}>
              Clear
            </button>
          )}
        </div>

        {notice && (
          <p
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              notice.onPhone ? 'bg-accent-50 text-accent-700' : 'bg-green-50 text-green-700'
            }`}
          >
            {notice.onPhone ? '⏳' : '✓'} {notice.text}
          </p>
        )}

        <PickOrAdd
          label="Level"
          options={levelOptions}
          value={selection.levelId}
          onChange={(levelId) => select({ levelId })}
          allowAdd={false}
        />
        {levelOptions.length === 0 && (
          <p className="text-sm text-amber-700">
            No levels on this work order yet.{' '}
            {canManage ? 'Add them on the work order page.' : 'Ask the admin to add them.'}
          </p>
        )}

        {level && (
          <LevelFactors
            // Keyed so picking another level closes an open editor.
            key={level._id}
            projectId={projectId}
            level={level}
            canEdit={canManage}
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
            let supervisor;
            try {
              supervisor = await mastersApi.createSupervisor(projectId, { name });
            } catch (err) {
              if (!err.offline) throw err;
              // Added for real when the entry is sent.
              supervisor = { _id: `${NEW_SUPERVISOR}${name.trim()}`, name: name.trim() };
            }
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

        {offline && (
          <p className="mb-2 text-sm text-accent-700">
            No signal: showing what this phone last loaded. Totals update once it&apos;s back online.
          </p>
        )}

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
                      entry.drillerHelper > 0 && `${entry.drillerHelper} driller + helper`,
                      entry.totalManpower > 0 && `${entry.totalManpower} manpower`,
                      entry.totalManpower > 0 && entry.oms != null && `OMS ${fmt(entry.oms)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {crewSummary(entry) && <div className="mt-1 text-sm text-slate-500">{crewSummary(entry)}</div>}
                  {entry.remark && <div className="mt-1 text-sm text-slate-500">“{entry.remark}”</div>}
                  {entry.outbox && <WaitingBadge item={entry.outbox} />}
                </div>
                <div className="flex shrink-0 items-center gap-4 text-sm font-medium">
                  <button type="button" className="text-brand-600" onClick={() => handleEdit(entry)}>
                    Edit
                  </button>
                  <button type="button" className="text-red-600" onClick={() => handleDelete(entry)}>
                    {entry.outbox ? 'Discard' : 'Delete'}
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
                  <th className="px-3 py-2 text-right font-medium">Driller + Helper</th>
                  <th className="px-3 py-2 text-right font-medium">Tons</th>
                  <th className="px-3 py-2 text-right font-medium">m³</th>
                </tr>
              </thead>
              <tbody>
                {monthToDate.map((m) => (
                  <tr key={m.levelId} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-900">{m.levelName}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{m.tubs}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{m.drillerHelper}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmt(m.tons)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{fmt(m.cubicMetres)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <LabourAndBilling date={date} labour={labour} canView={canManage} />
    </div>
  );
}
