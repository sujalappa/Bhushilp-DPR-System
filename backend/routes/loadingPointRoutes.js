const express = require('express');
const requireProjectManager = require('../middleware/requireProjectManager');
const requireProjectAccess = require('../middleware/requireProjectAccess');
const { list, create, update } = require('../controllers/loadingPointController');

const router = express.Router({ mergeParams: true });

// Same reasoning as vehicles/drivers: any project-assigned user can add a
// loading point on the fly; editing/deactivating stays superadmin-only.
router.get('/', requireProjectAccess, list);
router.post('/', requireProjectAccess, create);
router.patch('/:id', requireProjectManager, update);

module.exports = router;
