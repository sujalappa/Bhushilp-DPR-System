import { useEffect, useState } from 'react';
import * as projectsApi from '../../api/projects';
import * as exportApi from '../../api/export';
import AppShell from '../../components/AppShell';
import Button from '../../components/Button';
import Field, { inputClass } from '../../components/Field';
import ErrorBanner from '../../components/ErrorBanner';
import Spinner from '../../components/Spinner';

const TABS = [
  { key: 'trips', label: 'Trips' },
  { key: 'shiftLogs', label: 'Shift Logs' },
  { key: 'shiftStatus', label: 'Shift Status' },
  { key: 'production', label: 'Production' },
  { key: 'fuel', label: 'Fuel' },
];

export default function DataExport() {
  const [projects, setProjects] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [tab, setTab] = useState('trips');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    projectsApi
      .listProjects()
      .then((list) => {
        setProjects(list);
        if (list.length > 0) setProjectId(list[0]._id);
      })
      .catch((err) => setError(err.message));
  }, []);

  const loadPreview = () => {
    if (!projectId) return;
    setPreview(null);
    setError('');
    exportApi
      .getExportPreview(projectId, tab, { from, to })
      .then(setPreview)
      .catch((err) => setError(err.message));
  };

  useEffect(loadPreview, [projectId, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async () => {
    const project = projects.find((p) => p._id === projectId);
    setDownloading(true);
    setError('');
    try {
      await exportApi.downloadExportExcel(projectId, project.name, { from, to });
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AppShell title="Data Export" backTo="/projects">
      {projects === null ? (
        <Spinner full />
      ) : (
        <div className="space-y-4">
          <Field label="Project">
            <select className={inputClass()} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From (optional)">
              <input type="date" className={inputClass()} value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To (optional)">
              <input type="date" className={inputClass()} value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Button variant="secondary" onClick={loadPreview}>
            Apply date range
          </Button>

          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <ErrorBanner message={error} />

          {preview === null ? (
            <Spinner full />
          ) : (
            <>
              <p className="text-sm text-slate-500">{preview.rows.length} row(s)</p>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {preview.columns.map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-medium text-slate-600">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        {preview.columns.map((c) => (
                          <td key={c} className="whitespace-nowrap px-3 py-2 text-slate-700">
                            {String(row[c] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {preview.rows.length === 0 && (
                      <tr>
                        <td colSpan={preview.columns.length} className="px-3 py-6 text-center text-slate-400">
                          No data for this range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <Button variant="accent" className="w-full" onClick={handleDownload} disabled={downloading || !projectId}>
            {downloading ? 'Preparing file…' : 'Download full Excel backup (all 3 sheets)'}
          </Button>
        </div>
      )}
    </AppShell>
  );
}
