const express = require('express');
const requireProjectManager = require('../middleware/requireProjectManager');
const requireProjectAccess = require('../middleware/requireProjectAccess');
const { list, create, update } = require('../controllers/driverController');

const router = express.Router({ mergeParams: true });

// Same reasoning as vehicles: any project-assigned user can add a driver
// they haven't seen before (no pre-seeded list); editing/deactivating stays
// superadmin-only.
router.get('/', requireProjectAccess, list);
router.post('/', requireProjectAccess, create);
router.patch('/:id', requireProjectManager, update);

module.exports = router;
