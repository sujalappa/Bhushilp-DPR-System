const AppError = require('../utils/AppError');

// Gates project creation and master-data management to superadmins. Must run
// after `auth` so req.user is populated.
function requireSuperAdmin(req, res, next) {
  if (!req.user?.isSuperAdmin) {
    throw new AppError('Superadmin access required', 403);
  }
  next();
}

module.exports = requireSuperAdmin;
