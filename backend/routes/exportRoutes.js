const express = require('express');
const requireProjectManager = require('../middleware/requireProjectManager');
const { getPreview, downloadExcel } = require('../controllers/exportController');

// The superadmin and the project's admins only, deliberately — this reads
// across every driver/vehicle's full history for backup/reporting purposes,
// not scoped by form assignment like the rest of the project routes.
const router = express.Router({ mergeParams: true });

router.use(requireProjectManager);

router.get('/preview', getPreview);
router.get('/excel', downloadExcel);

module.exports = router;
