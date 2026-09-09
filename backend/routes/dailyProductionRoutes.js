const express = require('express');
const checkAssignment = require('../middleware/checkAssignment');
const { getDailyProduction, upsertDailyProduction } = require('../controllers/dailyProductionController');

const router = express.Router({ mergeParams: true });

router.use(checkAssignment('production'));

router.get('/', getDailyProduction);
router.post('/', upsertDailyProduction);

module.exports = router;
