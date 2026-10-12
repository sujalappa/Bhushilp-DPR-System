const express = require('express');
const requireProjectAccess = require('../middleware/requireProjectAccess');
const { getShiftStatus, setShiftStatus } = require('../controllers/shiftStatusController');

const router = express.Router({ mergeParams: true });

// Shared by every shift-based form (Shift Card, Daily Production, and both
// underground forms), so it's open to anyone assigned to the project
// rather than tied to one form.
router.use(requireProjectAccess);

router.get('/', getShiftStatus);
router.post('/', setShiftStatus);

module.exports = router;
