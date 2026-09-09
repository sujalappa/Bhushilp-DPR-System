const express = require('express');
const auth = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const resolveProjectConn = require('../middleware/resolveProjectConn');
const { listProjects, createProject } = require('../controllers/projectController');
const vehicleRoutes = require('./vehicleRoutes');
const driverRoutes = require('./driverRoutes');
const loadingPointRoutes = require('./loadingPointRoutes');
const shiftStatusRoutes = require('./shiftStatusRoutes');
const shiftLogRoutes = require('./shiftLogRoutes');
const dailyProductionRoutes = require('./dailyProductionRoutes');
const fuelRoutes = require('./fuelRoutes');
const exportRoutes = require('./exportRoutes');

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
router.use('/:projectId/export', resolveProjectConn, exportRoutes);

module.exports = router;
