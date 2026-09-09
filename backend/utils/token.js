const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'token';

// Turns "30d" / "12h" / "45m" / "60s" into milliseconds. Only used for the
// cookie's maxAge — jsonwebtoken itself accepts the "30d" style string directly.
function parseDurationToMs(duration) {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration format: "${duration}" (expected e.g. "30d")`);
  }
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return value * unitMs;
}

function signToken({ id, tokenVersion }) {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: parseDurationToMs(process.env.JWT_EXPIRES_IN),
  };
}

// Signs a fresh token and sets it on the response — used at login, and again
// on every authenticated request (see middleware/auth.js) to implement a
// sliding session: an active user's cookie keeps renewing itself, so they
// only get logged out after a real stretch of inactivity, never mid-use.
function issueTokenCookie(res, user) {
  const token = signToken({ id: user._id, tokenVersion: user.tokenVersion });
  res.cookie(COOKIE_NAME, token, getCookieOptions());
}

module.exports = {
  COOKIE_NAME,
  signToken,
  verifyToken,
  getCookieOptions,
  issueTokenCookie,
};
