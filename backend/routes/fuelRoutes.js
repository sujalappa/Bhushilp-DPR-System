const express = require('express');
const checkAssignment = require('../middleware/checkAssignment');
const { listFuelLogs, upsertFuelLog } = require('../controllers/fuelController');

const router = express.Router({ mergeParams: true });

router.use(checkAssignment('fuel'));

router.get('/', listFuelLogs);
router.post('/', upsertFuelLog);

module.exports = router;
