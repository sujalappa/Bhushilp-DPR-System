const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/central/User');
const Project = require('../models/central/Project');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES, roleOf, managesProject } = require('../utils/roles');

const SALT_ROUNDS = 12;

// Who manages whom: the superadmin manages every account; an admin manages
// the supervisors of their own projects (and ones they've added who have no
// project yet). Admins never see or change other admins or superadmins.
const isSuperAdmin = (user) => roleOf(user) === 'superadmin';
const inMyProjects = (me, projectId) => managesProject(me, projectId);

function canManage(me, target) {
  if (isSuperAdmin(me)) return true;
  if (roleOf(target) !== 'supervisor') return false;
  return (
    String(target.createdBy) === String(me._id) || target.assignments.some((a) => inMyProjects(me, a.projectId))
  );
}

async function findManageable(me, id) {
  const user = mongoose.isValidObjectId(id) ? await User.findById(id) : null;
  if (!user || !canManage(me, user)) throw new AppError('User not found', 404);
  return user;
}

// What an admin sees of a supervisor: only the access in their own projects.
function view(me, user) {
  const json = user.toJSON();
  if (!isSuperAdmin(me)) json.assignments = json.assignments.filter((a) => inMyProjects(me, a.projectId));
  return json;
}

// Validates assignments ({ projectId, forms }) and drops any for a project
// that no longer exists (e.g. a deleted project leaving a dangling
// reference) instead of rejecting the whole save. An admin may only grant
// access to their own projects.
async function cleanAssignments(me, assignments) {
  if (!Array.isArray(assignments)) throw new AppError('assignments must be an array', 400);
  for (const a of assignments) {
    if (!a.projectId || !Array.isArray(a.forms) || a.forms.length === 0) {
      throw new AppError('Each assignment needs a projectId and a non-empty forms array', 400);
    }
    if (!inMyProjects(me, a.projectId)) throw new AppError('You can only give access to your own projects', 403);
  }
  const existing = await Project.find({ _id: { $in: assignments.map((a) => a.projectId) } }).select('_id');
  const ids = new Set(existing.map((p) => p._id.toString()));
  return assignments.filter((a) => ids.has(String(a.projectId)));
}

async function cleanAdminProjects(adminProjects) {
  if (!Array.isArray(adminProjects)) throw new AppError('adminProjects must be an array', 400);
  const found = await Project.find({ _id: { $in: adminProjects.filter(mongoose.isValidObjectId) } }).select('_id');
  return found.map((p) => p._id);
}

function checkRole(role) {
  if (!ROLES.includes(role)) throw new AppError(`role must be one of: ${ROLES.join(', ')}`, 400);
}

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  const mine = users.filter((u) => canManage(req.user, u) && String(u._id) !== String(req.user._id));
  res.status(200).json({ success: true, data: isSuperAdmin(req.user) ? users : mine.map((u) => view(req.user, u)) });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, assignments, adminProjects } = req.body;
  if (!name || !email || !password) {
    throw new AppError('name, email and password are required', 400);
  }
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  // Older clients send isSuperAdmin instead of a role.
  const role = req.body.role || (req.body.isSuperAdmin ? 'superadmin' : 'supervisor');
  checkRole(role);
  if (!isSuperAdmin(req.user) && role !== 'supervisor') {
    throw new AppError('Admins can only add supervisors', 403);
  }

  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    role,
    adminProjects: role === 'admin' && adminProjects ? await cleanAdminProjects(adminProjects) : [],
    assignments: assignments ? await cleanAssignments(req.user, assignments) : [],
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: view(req.user, user) });
});

// Profile, role and login fields — assignments are handled separately below
// so "who can log in" and "what can they access" stay independent concerns.
// Only the superadmin changes roles or an admin's projects.
const updateUser = asyncHandler(async (req, res) => {
  const { name, email, active, password, role, adminProjects } = req.body;
  const user = await findManageable(req.user, req.params.id);
  const self = String(user._id) === String(req.user._id);

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email.toLowerCase().trim();

  const legacyRole = req.body.isSuperAdmin === undefined ? undefined : req.body.isSuperAdmin ? 'superadmin' : 'supervisor';
  const newRole = role ?? legacyRole;
  if (newRole !== undefined && newRole !== roleOf(user)) {
    if (!isSuperAdmin(req.user)) throw new AppError('Only the superadmin can change roles', 403);
    if (self) throw new AppError("You can't change your own role", 400);
    checkRole(newRole);
    user.role = newRole;
    user.tokenVersion += 1; // what they can do changed; log them in again
  }
  if (adminProjects !== undefined) {
    if (!isSuperAdmin(req.user)) throw new AppError("Only the superadmin can change an admin's projects", 403);
    user.adminProjects = await cleanAdminProjects(adminProjects);
  }

  if (password !== undefined) {
    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.tokenVersion += 1; // force re-login everywhere on password change
  }

  if (active !== undefined) {
    if (self && !active) throw new AppError("You can't disable your own account", 400);
    user.active = !!active;
    if (!user.active) user.tokenVersion += 1; // immediately kill any live session
  }

  await user.save();
  res.status(200).json({ success: true, data: view(req.user, user) });
});

// Replaces a user's form access. Kept as its own endpoint since it's the
// screen used most — grant/revoke a form on a project. An admin's save only
// covers their own projects; access the supervisor has elsewhere is kept.
const setAssignments = asyncHandler(async (req, res) => {
  const user = await findManageable(req.user, req.params.id);
  const assignments = await cleanAssignments(req.user, req.body.assignments);
  const elsewhere = isSuperAdmin(req.user) ? [] : user.assignments.filter((a) => !inMyProjects(req.user, a.projectId));

  user.assignments = [...elsewhere, ...assignments];
  await user.save();

  res.status(200).json({ success: true, data: view(req.user, user) });
});

module.exports = { listUsers, createUser, updateUser, setAssignments };
