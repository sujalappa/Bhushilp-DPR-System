const AppError = require('../utils/AppError');

// Factory: checkAssignment('shift-card') returns middleware gating a route
// to users assigned that form on the :projectId in the URL. This is the real
// access-control boundary — the frontend's route guard is UX only, this is
// what actually stops a request. isSuperAdmin bypasses it entirely.
const checkAssignment = (formSlug) => (req, res, next) => {
  if (req.user.isSuperAdmin) {
    return next();
  }

  const { projectId } = req.params;
  const assignment = req.user.assignments.find(
    (a) => a.projectId.toString() === projectId
  );

  if (!assignment || !assignment.forms.includes(formSlug)) {
    throw new AppError(`You don't have access to "${formSlug}" for this project`, 403);
  }

  next();
};

module.exports = checkAssignment;
