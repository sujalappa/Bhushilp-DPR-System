import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as projectsApi from '../api/projects';
import AppShell from '../components/AppShell';
import Button from '../components/Button';
import Field, { inputClass } from '../components/Field';
import ErrorBanner from '../components/ErrorBanner';
import Spinner from '../components/Spinner';

const TYPES = [
  { value: 'mining', label: 'Mining' },
  { value: 'exploration', label: 'Exploration' },
];

export default function ProjectList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState('mining');
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);

  const load = () => {
    projectsApi
      .listProjects(type)
      .then(setProjects)
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    setProjects(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Opens the project's card picker (ProjectFormsPage) — more cards
  // (Daily Production next) land there as they're built.
  const openProject = (projectId) => navigate(`/projects/${projectId}`);

  return (
    <AppShell title="Projects">
      <div className="mb-4 flex gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              type === t.value ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} />

      {projects === null && <Spinner full />}

      {projects?.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No {type} projects yet.
        </p>
      )}

      <div className="space-y-2">
        {projects?.map((p) => (
          <button
            key={p._id}
            onClick={() => openProject(p._id)}
            className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-300"
          >
            <div className="font-medium text-slate-900">{p.name}</div>
            {p.location && <div className="text-sm text-slate-500">{p.location}</div>}
          </button>
        ))}
      </div>

      {user.isSuperAdmin && (
        <div className="mt-6">
          {!showNewProject ? (
            <Button variant="accent" className="w-full" onClick={() => setShowNewProject(true)}>
              + New Project
            </Button>
          ) : (
            <NewProjectForm
              defaultType={type}
              onCreated={() => {
                setShowNewProject(false);
                load();
              }}
              onCancel={() => setShowNewProject(false)}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

function NewProjectForm({ defaultType, onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await projectsApi.createProject({ name, type, location });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <Field label="Project name">
        <input required autoFocus className={inputClass()} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Type">
        <select className={inputClass()} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Location (optional)">
        <input className={inputClass()} value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <ErrorBanner message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create project'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
