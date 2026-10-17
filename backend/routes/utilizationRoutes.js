const express = require('express');
const checkAssignment = require('../middleware/checkAssignment');
const { listUtilization, upsertUtilization, deleteUtilization } = require('../controllers/utilizationController');

const router = express.Router({ mergeParams: true });

router.use(checkAssignment('utilization'));

router.get('/', listUtilization);
router.post('/', upsertUtilization);
router.delete('/:entryId', deleteUtilization);

module.exports = router;
