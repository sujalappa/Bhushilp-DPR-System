// Three kinds of user:
//   superadmin — everything, every project; creates projects and admins.
//   admin      — everything inside the projects the superadmin gave them
//                (`adminProjects`): all forms and entries, work orders,
//                levels, rates, labour & billing, export, analysis, and the
//                supervisors who work there.
//   supervisor — fills in the forms they've been assigned (`assignments`).
const ROLES = ['superadmin', 'admin', 'supervisor'];

// Users saved before roles existed have only `isSuperAdmin`.
const roleOf = (user) => user?.role || (user?.isSuperAdmin ? 'superadmin' : 'supervisor');

// Whether this user runs the project: the superadmin, or one of its admins.
function managesProject(user, projectId) {
  const role = roleOf(user);
  if (role === 'superadmin') return true;
  return role === 'admin' && (user.adminProjects || []).some((id) => String(id) === String(projectId));
}

module.exports = { ROLES, roleOf, managesProject };
