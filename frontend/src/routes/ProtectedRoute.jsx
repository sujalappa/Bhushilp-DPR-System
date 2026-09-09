import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

// Mirrors the backend's `auth` middleware purely for UX (redirect before a
// doomed API call) — the real access boundary is always server-side.
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function RequireSuperAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isSuperAdmin) return <Navigate to="/projects" replace />;
  return children;
}

// Mirrors the backend's checkAssignment(formSlug) — reads :projectId from
// the URL and checks the logged-in user's own assignments.
export function RequireFormAccess({ formSlug, children }) {
  const { user, loading } = useAuth();
  const { projectId } = useParams();

  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;

  const allowed =
    user.isSuperAdmin ||
    user.assignments.some((a) => a.projectId === projectId && a.forms.includes(formSlug));

  if (!allowed) return <Navigate to="/projects" replace />;
  return children;
}
