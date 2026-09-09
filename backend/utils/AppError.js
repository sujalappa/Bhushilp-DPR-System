// Thrown deliberately for expected failure cases (bad input, not found,
// unauthorized) so errorHandler can distinguish them from bugs and respond
// with the right status code + a safe message.
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
