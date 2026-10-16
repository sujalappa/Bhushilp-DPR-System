const slugify = require('slugify');
const crypto = require('crypto');
const Project = require('../models/central/Project');
const { getProjectConnection } = require('../config/projectDb');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { roleOf } = require('../utils/roles');

// MongoDB enforces a 38-byte database name limit (confirmed against the
// live Atlas cluster), so this stays well under that: "dpr_" (4) +
// up to 15 slug chars + "_" + 6 hex suffix (for uniqueness when two
// projects share a name) = 26 chars max.
function makeDbName(name) {
  const base = slugify(name, { lower: true, strict: true }).slice(0, 15);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `dpr_${base}_${suffix}`;
}

const PROJECT_TYPES = ['mining', 'underground', 'exploration'];

const listProjects = asyncHandler(async (req, res) => {
  const filter = { status: 'active' };
  if (req.query.type) filter.type = req.query.type;

  // Everyone but the superadmin sees the projects they run or work on.
  if (roleOf(req.user) !== 'superadmin') {
    filter._id = { $in: [...req.user.adminProjects, ...req.user.assignments.map((a) => a.projectId)] };
  }

  const projects = await Project.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: projects });
});

const createProject = asyncHandler(async (req, res) => {
  const { name, type, location } = req.body;
  if (!name || !type) {
    throw new AppError('name and type are required', 400);
  }
  if (!PROJECT_TYPES.includes(type)) {
    throw new AppError(`type must be one of: ${PROJECT_TYPES.join(', ')}`, 400);
  }

  const project = await Project.create({
    name,
    type,
    location,
    dbName: makeDbName(name),
    createdBy: req.user._id,
  });

  // Warm the connection now so the first data-entry request against this
  // project isn't the one paying for the initial connect.
  await getProjectConnection(project.dbName);

  res.status(201).json({ success: true, data: project });
});

module.exports = { listProjects, createProject };
