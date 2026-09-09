const AppError = require('../utils/AppError');

// Central error handler — every AppError thrown anywhere (sync or via
// asyncHandler) lands here, plus a few common Mongoose failure shapes are
// translated into sane HTTP responses instead of leaking a 500 + stack trace.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let error = err;

  if (err.name === 'CastError') {
    error = new AppError(`Invalid value for "${err.path}"`, 400);
  } else if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new AppError(messages.join(', '), 400);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new AppError(`A record with that ${field} already exists`, 409);
  } else if (!(err instanceof AppError)) {
    console.error(err);
    error = new AppError('Something went wrong', 500);
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
  });
}

module.exports = errorHandler;
