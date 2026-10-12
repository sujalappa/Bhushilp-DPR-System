const express = require('express');
const checkAssignment = require('../middleware/checkAssignment');
const { listFuelLogs, upsertFuelLog, deleteFuelLog } = require('../controllers/fuelController');

const router = express.Router({ mergeParams: true });

router.use(checkAssignment('fuel'));

router.get('/', listFuelLogs);
router.post('/', upsertFuelLog);
router.delete('/:fuelLogId', deleteFuelLog);

module.exports = router;
