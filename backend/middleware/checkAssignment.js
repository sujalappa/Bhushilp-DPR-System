const AppError = require('../utils/AppError');
const { managesProject } = require('../utils/roles');

// Factory: checkAssignment('shift-card') returns middleware gating a route
// to users assigned that form on the :projectId in the URL. This is the real
// access-control boundary — the frontend's route guard is UX only, this is
// what actually stops a request. The superadmin and the project's admins
// have every form, so they bypass it.
const checkAssignment = (formSlug) => (req, res, next) => {
  const { projectId } = req.params;
  if (managesProject(req.user, projectId)) {
    return next();
  }

  const assignment = req.user.assignments.find(
    (a) => a.projectId.toString() === projectId
  );

  if (!assignment || !assignment.forms.includes(formSlug)) {
    throw new AppError(`You don't have access to "${formSlug}" for this project`, 403);
  }

  next();
};

module.exports = checkAssignment;
