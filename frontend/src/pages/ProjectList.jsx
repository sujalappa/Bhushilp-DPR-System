import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleOf } from '../utils/roles';
import * as projectsApi from '../api/projects';
import AppShell from '../components/AppShell';
import Button from '../components/Button';
import Field, { inputClass } from '../components/Field';
import ErrorBanner from '../components/ErrorBanner';
import Spinner from '../components/Spinner';
import { PROJECT_TYPES as TYPES } from '../utils/forms';

export default function ProjectList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // null until the user picks a tab; until then the page opens on the first
  // tab that has a project for them, so someone assigned only to an
  // underground mine doesn't land on an empty Open Cast list.
  const [pickedType, setPickedType] = useState(null);
  const [allProjects, setAllProjects] = useState(null);
  const [error, setError] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Every project the user can see is loaded once and the tabs filter it
  // locally, so switching tabs is instant and can't show a stale list.
  useEffect(() => {
    let cancelled = false;
    projectsApi
      .listProjects()
      .then((list) => !cancelled && setAllProjects(list))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const firstTypeWithProjects = TYPES.find((t) => allProjects?.some((p) => p.type === t.value))?.value;
  const type = pickedType || firstTypeWithProjects || TYPES[0].value;
  const setType = setPickedType;
  const projects = allProjects?.filter((p) => p.type === type) ?? null;

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
            className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium ${
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
          No {TYPES.find((t) => t.value === type).label} projects yet.
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

      {/* Only the superadmin starts projects; admins run the ones they're given. */}
      {roleOf(user) === 'superadmin' && (
        <div className="mt-6">
          {!showNewProject ? (
            <Button variant="accent" className="w-full" onClick={() => setShowNewProject(true)}>
              + New Project
            </Button>
          ) : (
            <NewProjectForm
              defaultType={type}
              onCreated={(created) => {
                setShowNewProject(false);
                // Show the tab the new project went into.
                setPickedType(created.type);
                setReloadKey((k) => k + 1);
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
      onCreated(await projectsApi.createProject({ name, type, location }));
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
