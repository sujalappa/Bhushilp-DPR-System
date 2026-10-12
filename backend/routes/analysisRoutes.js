const express = require('express');
const requireSuperAdmin = require('../middleware/requireSuperAdmin');
const { getAnalysis } = require('../controllers/analysisController');

// Superadmin-only, like the export: it reads across every entry in the
// project rather than one form's worth.
const router = express.Router({ mergeParams: true });

router.use(requireSuperAdmin);
router.get('/', getAnalysis);

module.exports = router;
