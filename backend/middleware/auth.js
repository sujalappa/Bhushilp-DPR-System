const User = require('../models/central/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { COOKIE_NAME, verifyToken, issueTokenCookie } = require('../utils/token');

// Verifies the session cookie, loads the user, and rejects a token whose
// tokenVersion is stale (an admin can force-logout a user by bumping it,
// e.g. after revoking access — see userController).
const auth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    throw new AppError('Not authenticated', 401);
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new AppError('Session expired or invalid, please log in again', 401);
  }

  const user = await User.findById(payload.id);
  if (!user || !user.active) {
    throw new AppError('Account not found or disabled', 401);
  }
  if (user.tokenVersion !== payload.tokenVersion) {
    throw new AppError('Session no longer valid, please log in again', 401);
  }

  req.user = user;

  // Sliding session: a request that proves the cookie is still valid earns
  // it a fresh expiry, so an actively-used device is never forced to
  // re-login mid-shift.
  issueTokenCookie(res, user);

  next();
});

module.exports = auth;
