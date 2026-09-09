const bcrypt = require('bcryptjs');
const User = require('../models/central/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { issueTokenCookie, COOKIE_NAME, getCookieOptions } = require('../utils/token');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  // Same message for "no such user" and "wrong password" — don't reveal
  // which one it was.
  if (!user || !user.active) {
    throw new AppError('Invalid email or password', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  issueTokenCookie(res, user);
  res.status(200).json({ success: true, data: user });
});

const logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, getCookieOptions());
  res.status(200).json({ success: true, data: null });
};

// req.user is already loaded fresh from the DB by the `auth` middleware, so
// this doubles as the "resolve my current assignments" endpoint the
// frontend nav is built from.
const me = (req, res) => {
  res.status(200).json({ success: true, data: req.user });
};

module.exports = { login, logout, me };
