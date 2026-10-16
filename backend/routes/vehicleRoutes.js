const express = require('express');
const requireProjectManager = require('../middleware/requireProjectManager');
const requireProjectAccess = require('../middleware/requireProjectAccess');
const { listVehicles, createVehicle, updateVehicle } = require('../controllers/vehicleController');

// mergeParams: true — this router is mounted at /api/projects/:projectId/vehicles,
// and needs :projectId from the parent for resolveProjectConn (applied by the parent).
const router = express.Router({ mergeParams: true });

// Any user with access to this project can read the list AND add a new
// vehicle on the fly (there's no pre-seeded master list — a clerk hits an
// unlisted vehicle and adds it inline, same as adding a driver). Editing or
// deactivating an existing vehicle is a more consequential action (rename,
// pull it out of service mid-use) and is left to the superadmin and the
// project's admins.
router.get('/', requireProjectAccess, listVehicles);
router.post('/', requireProjectAccess, createVehicle);
router.patch('/:id', requireProjectManager, updateVehicle);

module.exports = router;
