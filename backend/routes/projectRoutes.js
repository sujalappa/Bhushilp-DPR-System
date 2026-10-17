const express = require('express');
const auth = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const resolveProjectConn = require('../middleware/resolveProjectConn');
const requireProjectType = require('../middleware/requireProjectType');
const { listProjects, createProject } = require('../controllers/projectController');
const vehicleRoutes = require('./vehicleRoutes');
const driverRoutes = require('./driverRoutes');
const loadingPointRoutes = require('./loadingPointRoutes');
const shiftStatusRoutes = require('./shiftStatusRoutes');
const shiftLogRoutes = require('./shiftLogRoutes');
const dailyProductionRoutes = require('./dailyProductionRoutes');
const fuelRoutes = require('./fuelRoutes');
const utilizationRoutes = require('./utilizationRoutes');
const exportRoutes = require('./exportRoutes');
const analysisRoutes = require('./analysisRoutes');
const underground = require('./undergroundRoutes');

const router = express.Router();

router.use(auth);

router.get('/', listProjects);
router.post('/', requireSuperAdmin, createProject);

// Everything below targets a specific project's own database — resolveProjectConn
// attaches req.projectModels before any of these routers run.
router.use('/:projectId/vehicles', resolveProjectConn, vehicleRoutes);
router.use('/:projectId/drivers', resolveProjectConn, driverRoutes);
router.use('/:projectId/loading-points', resolveProjectConn, loadingPointRoutes);
router.use('/:projectId/shift-status', resolveProjectConn, shiftStatusRoutes);
router.use('/:projectId/shift-logs', resolveProjectConn, shiftLogRoutes);
router.use('/:projectId/production', resolveProjectConn, dailyProductionRoutes);
router.use('/:projectId/fuel', resolveProjectConn, fuelRoutes);
router.use('/:projectId/utilization', resolveProjectConn, utilizationRoutes);
router.use('/:projectId/export', resolveProjectConn, exportRoutes);
router.use('/:projectId/analysis', resolveProjectConn, analysisRoutes);

// Underground projects only.
const ug = [resolveProjectConn, requireProjectType('underground')];
router.use('/:projectId/work-orders', ug, underground.workOrderRoutes);
router.use('/:projectId/levels', ug, underground.levelRoutes);
router.use('/:projectId/supervisors', ug, underground.supervisorRoutes);
router.use('/:projectId/workers', ug, underground.workerRoutes);
router.use('/:projectId/headings', ug, underground.headingRoutes);
router.use('/:projectId/ug-production', ug, underground.ugProductionRoutes);
router.use('/:projectId/ug-development', ug, underground.ugDevelopmentRoutes);

module.exports = router;
