const AppError = require('../utils/AppError');

// Factory: requireProjectType('underground') keeps a set of routes to
// projects of that type. Runs after resolveProjectConn (which sets
// req.project), so an underground form can't be used against an open-cast
// project's database by hand-editing the URL.
const requireProjectType = (type) => (req, res, next) => {
  if (req.project.type !== type) {
    throw new AppError(`This is only available for ${type} projects`, 400);
  }
  next();
};

module.exports = requireProjectType;
