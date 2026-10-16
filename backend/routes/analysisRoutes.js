const express = require('express');
const requireProjectManager = require('../middleware/requireProjectManager');
const { getAnalysis } = require('../controllers/analysisController');

// The superadmin and the project's admins only, like the export: it reads
// across every entry in the project rather than one form's worth.
const router = express.Router({ mergeParams: true });

router.use(requireProjectManager);
router.get('/', getAnalysis);

module.exports = router;
