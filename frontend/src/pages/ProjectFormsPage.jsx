import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useProject from '../hooks/useProject';
import AppShell from '../components/AppShell';
import ErrorBanner from '../components/ErrorBanner';
import Spinner from '../components/Spinner';
import { formsForProjectType } from '../utils/forms';
import WorkOrderList from './underground/WorkOrderList';
import { hasFormAccess as canUseForm, managesProject } from '../utils/roles';

// The "cards" screen for one project — sits between the project list and
// an actual form. Which cards appear depends on the project's type: an
// underground mine reports different things from an open-cast one.
export default function ProjectFormsPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { project, missing, error } = useProject(projectId);

  useEffect(() => {
    // Not in this user's list — either a bad URL or a project they don't
    // have any access to. Same effect either way.
    if (missing) navigate('/projects', { replace: true });
  }, [missing, navigate]);

  const hasFormAccess = (slug) => canUseForm(user, projectId, slug);

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
  const visibleForms = formsForProjectType(project.type).filter((f) => !f.implemented || hasFormAccess(f.slug));

  // An underground mine's forms sit one level down, inside a work order.
  if (project.type === 'underground') {
    return (
      <AppShell title={project.name} backTo="/projects">
        <WorkOrderList projectId={projectId} canManage={managesProject(user, projectId)} />
      </AppShell>
    );
  }

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
