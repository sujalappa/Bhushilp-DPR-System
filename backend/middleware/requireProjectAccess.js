const AppError = require('../utils/AppError');

// Looser than checkAssignment(formSlug): lets a user through if they have
// *any* assignment on this project, regardless of which form. Used for
// read-only master data (vehicles/drivers/loading-points) — a clerk
// assigned only "shift-card" still needs to read the vehicle list to
// populate that form's dropdown, even though only a superadmin may edit it.
function requireProjectAccess(req, res, next) {
  if (req.user.isSuperAdmin) {
    return next();
  }

  const { projectId } = req.params;
  const hasAccess = req.user.assignments.some((a) => a.projectId.toString() === projectId);
  if (!hasAccess) {
    throw new AppError('You do not have access to this project', 403);
  }

  next();
}

module.exports = requireProjectAccess;
