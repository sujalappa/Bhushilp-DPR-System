const Project = require('../models/central/Project');
const { getProjectConnection } = require('../config/projectDb');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Looks up the project referenced by :projectId in the URL and attaches its
// dedicated DB connection + compiled models to the request, so downstream
// controllers never touch mongoose directly — just req.projectModels.*
const resolveProjectConn = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);
  if (!project || project.status === 'archived') {
    throw new AppError('Project not found', 404);
  }

  const { models } = await getProjectConnection(project.dbName);

  req.project = project;
  req.projectModels = models;

  next();
});

module.exports = resolveProjectConn;
