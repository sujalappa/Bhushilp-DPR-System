import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as projectsApi from '../api/projects';
import AppShell from '../components/AppShell';
import ErrorBanner from '../components/ErrorBanner';
import Spinner from '../components/Spinner';
import { ALL_FORMS } from '../utils/forms';

// The "cards" screen for one project — sits between the project list and
// an actual form. Only one card (Shift Card) is real today; the rest show
// as "Coming soon" so the picker doesn't need rebuilding as each new sheet
// (Production next, then Fuel, Breakdown, ...) comes online.
export default function ProjectFormsPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    projectsApi
      .listProjects()
      .then((projects) => {
        const found = projects.find((p) => p._id === projectId);
        if (!found) {
          // Not in this user's list — either a bad URL or a project they
          // don't have any access to. Same effect either way.
          navigate('/projects', { replace: true });
          return;
        }
        setProject(found);
      })
      .catch((err) => setError(err.message));
  }, [projectId, navigate]);

  const hasFormAccess = (slug) =>
    user.isSuperAdmin || user.assignments.some((a) => a.projectId === projectId && a.forms.includes(slug));

  if (error) {
    return (
      <AppShell title="Project" backTo="/projects">
        <ErrorBanner message={error} />
      </AppShell>
    );
  }
  if (!project) {
    return (
      <AppShell title="Project">
        <Spinner full />
      </AppShell>
    );
  }

  // Not-yet-implemented cards are shown to everyone with project access as
  // a preview of what's coming; implemented ones stay gated by assignment,
  // same as everywhere else in the app.
  const visibleForms = ALL_FORMS.filter((f) => !f.implemented || hasFormAccess(f.slug));

  return (
    <AppShell title={project.name} backTo="/projects">
      <div className="space-y-2">
        {visibleForms.map((f) => (
          <button
            key={f.slug}
            disabled={!f.implemented}
            onClick={() => f.implemented && navigate(`/projects/${projectId}/${f.slug}`)}
            className={`flex w-full items-center justify-between rounded-lg border p-4 text-left shadow-sm ${
              f.implemented
                ? 'border-slate-200 bg-white hover:border-brand-300'
                : 'cursor-not-allowed border-dashed border-slate-300 bg-slate-50'
            }`}
          >
            <span className={`font-medium ${f.implemented ? 'text-slate-900' : 'text-slate-400'}`}>{f.label}</span>
            {!f.implemented && (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-500">
                Coming soon
              </span>
            )}
          </button>
        ))}
      </div>
    </AppShell>
  );
}
