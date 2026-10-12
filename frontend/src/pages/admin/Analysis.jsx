import { useEffect, useState } from 'react';
import * as projectsApi from '../../api/projects';
import * as analysisApi from '../../api/analysis';
import AppShell from '../../components/AppShell';
import Field, { inputClass } from '../../components/Field';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';
import { todayIso } from '../../utils/date';
import { PROJECT_TYPES } from '../../utils/forms';
import UndergroundAnalysis from './analysis/UndergroundAnalysis';
import OpenCastAnalysis from './analysis/OpenCastAnalysis';

const isoDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Each preset resolves to a { from, to } pair; "Custom" uses the two date
// boxes instead.
const PRESETS = [
  { key: 'month', label: 'This month', range: () => ({ from: `${todayIso().slice(0, 8)}01`, to: todayIso() }) },
  { key: '7', label: 'Last 7 days', range: () => ({ from: isoDaysAgo(6), to: todayIso() }) },
  { key: '30', label: 'Last 30 days', range: () => ({ from: isoDaysAgo(29), to: todayIso() }) },
  { key: 'custom', label: 'Custom' },
];

// Superadmin-only charts over a project's entries. Which charts appear
// depends on the project's type, same as its forms.
export default function Analysis() {
  const [projects, setProjects] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [preset, setPreset] = useState('month');
  const [custom, setCustom] = useState(() => PRESETS[0].range());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    projectsApi
      .listProjects()
      .then((list) => {
        setProjects(list);
        if (list.length > 0) setProjectId(list[0]._id);
      })
      .catch((err) => setError(err.message));
  }, []);

  const { from, to } = preset === 'custom' ? custom : PRESETS.find((p) => p.key === preset).range();

  useEffect(() => {
    if (!projectId || !from || !to) return undefined;
    let cancelled = false;
    setData(null);
    setError('');
    analysisApi
      .getAnalysis(projectId, { from, to })
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [projectId, from, to]);

  const typeLabel = (type) => PROJECT_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <AppShell title="Analysis" backTo="/projects">
      {projects === null && !error && <Spinner full />}
      {projects?.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No projects yet.
        </p>
      )}

      {projects?.length > 0 && (
        <div className="space-y-4">
          {/* All filters in one block above the charts. */}
          <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
            <Field label="Project">
              <select className={inputClass()} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({typeLabel(p.type)})
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Period</span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      // Start a custom range from whatever was showing.
                      if (p.key === 'custom') setCustom({ from, to });
                      setPreset(p.key);
                    }}
                    className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium ${
                      preset === p.key ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="From">
                  <input
                    type="date"
                    max={custom.to || todayIso()}
                    className={inputClass()}
                    value={custom.from}
                    onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                  />
                </Field>
                <Field label="To">
                  <input
                    type="date"
                    min={custom.from}
                    max={todayIso()}
                    className={inputClass()}
                    value={custom.to}
                    onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                  />
                </Field>
              </div>
            )}
          </div>

          <ErrorBanner message={error} />
          {data === null && !error && <Spinner full />}
          {data?.kind === 'underground' && <UndergroundAnalysis data={data} />}
          {data?.kind === 'open-cast' && <OpenCastAnalysis data={data} />}
        </div>
      )}
    </AppShell>
  );
}
