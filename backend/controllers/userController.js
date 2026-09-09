const bcrypt = require('bcryptjs');
const User = require('../models/central/User');
const Project = require('../models/central/Project');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const SALT_ROUNDS = 12;

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: users });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, isSuperAdmin, assignments } = req.body;
  if (!name || !email || !password) {
    throw new AppError('name, email and password are required', 400);
  }
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    isSuperAdmin: !!isSuperAdmin,
    assignments: assignments || [],
  });

  res.status(201).json({ success: true, data: user });
});

// Basic profile fields only — assignments are handled separately below so
// "who can log in" and "what can they access" stay independent concerns.
const updateUser = asyncHandler(async (req, res) => {
  const { name, email, isSuperAdmin, active, password } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email.toLowerCase().trim();
  if (isSuperAdmin !== undefined) user.isSuperAdmin = !!isSuperAdmin;

  if (password !== undefined) {
    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.tokenVersion += 1; // force re-login everywhere on password change
  }

  if (active !== undefined) {
    user.active = !!active;
    if (!user.active) user.tokenVersion += 1; // immediately kill any live session
  }

  await user.save();
  res.status(200).json({ success: true, data: user });
});

// Replaces the full assignments array for a user. Kept as its own endpoint
// (rather than folded into updateUser) since this is the screen a superadmin
// uses most often — grant/revoke a form on a project.
const setAssignments = asyncHandler(async (req, res) => {
  const { assignments } = req.body;
  if (!Array.isArray(assignments)) {
    throw new AppError('assignments must be an array', 400);
  }

  for (const a of assignments) {
    if (!a.projectId || !Array.isArray(a.forms) || a.forms.length === 0) {
      throw new AppError('Each assignment needs a projectId and a non-empty forms array', 400);
    }
  }

  // Drop any assignment pointing at a project that no longer exists (e.g. a
  // deleted project leaving a dangling reference on some user) instead of
  // rejecting the whole save. A stale reference like that has no legitimate
  // meaning any more and should never permanently block an admin from
  // fixing everything else about this user's access — it just quietly
  // gets cleaned up the next time assignments are saved.
  const projectIds = assignments.map((a) => a.projectId);
  const existingProjects = await Project.find({ _id: { $in: projectIds } }).select('_id');
  const existingIds = new Set(existingProjects.map((p) => p._id.toString()));
  const validAssignments = assignments.filter((a) => existingIds.has(String(a.projectId)));

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  user.assignments = validAssignments;
  await user.save();

  res.status(200).json({ success: true, data: user });
});

module.exports = { listUsers, createUser, updateUser, setAssignments };
