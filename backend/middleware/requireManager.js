const AppError = require('../utils/AppError');
const { roleOf } = require('../utils/roles');

// Superadmins and admins — for user management, where each controller then
// limits an admin to the supervisors of their own projects.
function requireManager(req, res, next) {
  if (!['superadmin', 'admin'].includes(roleOf(req.user))) {
    throw new AppError('Admin access required', 403);
  }
  next();
}

module.exports = requireManager;
