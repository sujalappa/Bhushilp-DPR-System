const express = require('express');
const checkAssignment = require('../middleware/checkAssignment');
const { listShiftLogs, getShiftLog, upsertShiftLog, deleteShiftLog } = require('../controllers/shiftLogController');
const tripRoutes = require('./tripRoutes');

const router = express.Router({ mergeParams: true });

router.use(checkAssignment('shift-card'));

router.get('/', listShiftLogs);
router.post('/', upsertShiftLog);
router.get('/:shiftLogId', getShiftLog);
router.delete('/:shiftLogId', deleteShiftLog);
router.use('/:shiftLogId/trips', tripRoutes);

module.exports = router;
