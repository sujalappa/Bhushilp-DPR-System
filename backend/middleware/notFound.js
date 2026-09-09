const AppError = require('../utils/AppError');

// Mounted after all routes — anything that reaches here matched no route.
function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

module.exports = notFound;
