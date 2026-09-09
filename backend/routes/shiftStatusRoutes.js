const express = require('express');
const checkAssignment = require('../middleware/checkAssignment');
const { getShiftStatus, setShiftStatus } = require('../controllers/shiftStatusController');

const router = express.Router({ mergeParams: true });

router.use(checkAssignment('shift-card'));

router.get('/', getShiftStatus);
router.post('/', setShiftStatus);

module.exports = router;
