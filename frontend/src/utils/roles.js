// The three kinds of user, as the server defines them (backend/utils/roles.js):
// the superadmin runs everything; an admin runs the projects they were
// given (`adminProjects`); a supervisor fills in their assigned forms.
// These checks only shape the screens — the server enforces the real rules.

export const ROLE_LABELS = { superadmin: 'Superadmin', admin: 'Admin', supervisor: 'Supervisor' };

// Accounts saved before roles existed have only `isSuperAdmin`.
export const roleOf = (user) => user?.role || (user?.isSuperAdmin ? 'superadmin' : 'supervisor');

export const isManager = (user) => ['superadmin', 'admin'].includes(roleOf(user));

export function managesProject(user, projectId) {
  const role = roleOf(user);
  if (role === 'superadmin') return true;
  return role === 'admin' && (user.adminProjects || []).some((id) => String(id) === String(projectId));
}

export const hasFormAccess = (user, projectId, formSlug) =>
  managesProject(user, projectId) ||
  (user.assignments || []).some((a) => a.projectId === projectId && a.forms.includes(formSlug));
