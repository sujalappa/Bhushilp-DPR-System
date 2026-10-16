const AppError = require('../utils/AppError');
const { managesProject } = require('../utils/roles');

// Gates a project's management actions — editing master lists, work orders
// and levels, export, analysis — to the superadmin and that project's
// admins. Reads :projectId from the URL, so it must sit under a route that
// has it (with mergeParams on nested routers).
function requireProjectManager(req, res, next) {
  if (!managesProject(req.user, req.params.projectId)) {
    throw new AppError('Admin access to this project required', 403);
  }
  next();
}

module.exports = requireProjectManager;
